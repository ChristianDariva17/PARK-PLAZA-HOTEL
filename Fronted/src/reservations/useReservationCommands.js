import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptReservationAvailabilityResponse, adaptReservationCommandResponse, adaptReservationCreateResponse, adaptReservationDetailResponse, adaptReservationListResponse, buildReservationAvailabilityQuery, buildReservationCreateDto, buildReservationLifecycleDto } from './reservationModel.js';
import { cancelReservation, confirmReservation, createReservation, createReservationCancellationError, createReservationIdempotencyKey, dispositionReservation, getReservationAvailability, getReservationDetail, getReservations, ReservationRequestError } from './reservationsClient.js';
import { hasReservationCreateAccess, hasReservationLifecycleAccess, isCurrentReservationOperation, reservationReconciliationSucceeded } from './reservationRequestPolicy.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createReservationCommands({
  authRef,
  commitInternal,
  reloadReservations,
  loadReservationAvailability,
  refreshReservationBoundary,
  reservationCreateGenerationRef,
  reservationCreateControllerRef,
  reservationLifecycleGenerationRef,
  reservationLifecycleControllerRef,
}) {
  const assertReservationCreateAccess = () => {
    const current = authRef.current;
    if (!hasReservationCreateAccess(current.authStatus, current.permissions)) {
      throw new ReservationRequestError('No cuenta con todos los permisos necesarios para crear reservas.', 403);
    }
  };

  const create = async (input) => {
    assertReservationCreateAccess();
    const body = buildReservationCreateDto(input);
    const availabilityQuery = { checkInAt: body.checkInAt, checkOutAt: body.checkOutAt, guestCount: body.guestCount };
    const generation = reservationCreateGenerationRef.current + 1;
    reservationCreateGenerationRef.current = generation;
    reservationCreateControllerRef.current?.abort();
    const controller = new AbortController();
    reservationCreateControllerRef.current = controller;
    commitInternal({ type: 'RESERVATION_CREATE_STARTED' });
    let reservation;
    try {
      const response = await createReservation(body, controller.signal);
      if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      reservation = adaptReservationCreateResponse(response, body);
    } catch (error) {
      if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      if (error.reloadRecommended || error.ambiguous) {
        commitInternal({ type: 'RESERVATION_CREATE_RECONCILING', error: error.message });
        try {
          await refreshReservationBoundary(availabilityQuery);
        } catch (reconciliationError) {
          if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
          commitInternal({ type: 'RESERVATION_CREATE_FAILED', error: reconciliationError.message, retryBlocked: true });
          throw reconciliationError;
        }
      }
      if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      commitInternal({ type: 'RESERVATION_CREATE_FAILED', error: error.message, retryBlocked: false });
      throw error;
    }

    if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
    commitInternal({ type: 'RESERVATION_CREATE_COMMITTED', reservation });
    await Promise.allSettled([reloadReservations(), loadReservationAvailability(availabilityQuery)]);
    if (!isCurrentReservationOperation(generation, reservationCreateGenerationRef.current, controller.signal)) throw createReservationCancellationError();
    return reservation;
  };

  const lifecycle = async (reservationId, operation, input = {}, key = createReservationIdempotencyKey()) => {
    const current = authRef.current;
    if (!hasReservationLifecycleAccess(current.authStatus, current.permissions, operation)) throw new ReservationRequestError('No cuenta con permiso para esta acción de reserva.', 403);
    const body = buildReservationLifecycleDto(operation, input);
    const generation = reservationLifecycleGenerationRef.current + 1;
    reservationLifecycleGenerationRef.current = generation;
    reservationLifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    reservationLifecycleControllerRef.current = controller;
    const request = operation === 'confirm'
      ? confirmReservation(reservationId, key, controller.signal)
      : operation === 'cancel'
        ? cancelReservation(reservationId, body, key, controller.signal)
        : dispositionReservation(reservationId, body, key, controller.signal);
    try {
      const result = adaptReservationCommandResponse(await request);
      if (!isCurrentReservationOperation(generation, reservationLifecycleGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      await reloadReservations();
      return result;
    } catch (error) {
      if (!isCurrentReservationOperation(generation, reservationLifecycleGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      if (error.reloadRecommended || error.ambiguous) await reloadReservations().catch(() => {});
      throw error;
    }
  };

  const detail = async (reservationId) => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.reservationsRead)) throw new ReservationRequestError('No cuenta con permiso para ver reservas.', 403);
    const generation = reservationLifecycleGenerationRef.current + 1;
    reservationLifecycleGenerationRef.current = generation;
    reservationLifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    reservationLifecycleControllerRef.current = controller;
    const result = adaptReservationDetailResponse(await getReservationDetail(reservationId, controller.signal));
    if (!isCurrentReservationOperation(generation, reservationLifecycleGenerationRef.current, controller.signal)) throw createReservationCancellationError();
    return result;
  };

  return { create, detail, lifecycle };
}

export function useReservationCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const reservationGenerationRef = useRef(0);
  const reservationControllerRef = useRef(null);
  const availabilityGenerationRef = useRef(0);
  const availabilityControllerRef = useRef(null);
  const reservationCreateGenerationRef = useRef(0);
  const reservationCreateControllerRef = useRef(null);
  const reservationLifecycleGenerationRef = useRef(0);
  const reservationLifecycleControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelReservationLoad = useCallback(() => {
    reservationControllerRef.current?.abort();
    reservationControllerRef.current = null;
    if (projectedState.current.reservationRequest?.status === 'loading') commitInternal({ type: 'RESERVATIONS_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelReservationAvailability = useCallback(() => {
    availabilityControllerRef.current?.abort();
    availabilityControllerRef.current = null;
    if (projectedState.current.reservationAvailabilityRequest?.status === 'loading') commitInternal({ type: 'RESERVATION_AVAILABILITY_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelReservationCreate = useCallback(() => {
    reservationCreateControllerRef.current?.abort();
    reservationCreateControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.reservationCreateRequest?.status)) commitInternal({ type: 'RESERVATION_CREATE_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runReservationLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'RESERVATIONS_LOAD_STARTED' });
    try {
      const list = adaptReservationListResponse(await getReservations(controller.signal));
      if (generation !== reservationGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'RESERVATIONS_LOAD_SUCCEEDED', reservations: list });
      return list;
    } catch (error) {
      if (generation !== reservationGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'RESERVATIONS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadReservations = useCallback(() => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.reservationsRead)) {
      return Promise.reject(new ReservationRequestError('No cuenta con permiso para consultar reservas.', 403));
    }
    const generation = reservationGenerationRef.current + 1;
    reservationGenerationRef.current = generation;
    cancelReservationLoad();
    const controller = new AbortController();
    reservationControllerRef.current = controller;
    return runReservationLoad(generation, controller);
  }, [cancelReservationLoad, runReservationLoad]);

  const loadReservationAvailability = useCallback(async (input) => {
    const current = authRef.current;
    if (!hasReservationCreateAccess(current.authStatus, current.permissions)) throw new ReservationRequestError('No cuenta con todos los permisos necesarios para crear reservas.', 403);
    const query = buildReservationAvailabilityQuery(input);
    const generation = availabilityGenerationRef.current + 1;
    availabilityGenerationRef.current = generation;
    cancelReservationAvailability();
    const controller = new AbortController();
    availabilityControllerRef.current = controller;
    commitInternal({ type: 'RESERVATION_AVAILABILITY_STARTED' });
    try {
      const availability = adaptReservationAvailabilityResponse(await getReservationAvailability(query, controller.signal));
      if (!isCurrentReservationOperation(generation, availabilityGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      if (availability.checkInAt !== query.checkInAt || availability.checkOutAt !== query.checkOutAt || availability.guestCount !== query.guestCount) throw new ReservationRequestError('La disponibilidad recibida no corresponde a la consulta actual.', null, true, 'invalid_response', true);
      commitInternal({ type: 'RESERVATION_AVAILABILITY_SUCCEEDED', availability });
      return availability;
    } catch (error) {
      if (!isCurrentReservationOperation(generation, availabilityGenerationRef.current, controller.signal)) throw createReservationCancellationError();
      if (error.status === 401) {
        commitInternal({ type: 'RESERVATION_AVAILABILITY_CANCELLED' });
        return null;
      }
      commitInternal({ type: 'RESERVATION_AVAILABILITY_FAILED', error: error.message });
      throw error;
    }
  }, [cancelReservationAvailability, commitInternal]);

  const clearReservationAvailability = useCallback(() => {
    availabilityGenerationRef.current += 1;
    cancelReservationAvailability();
    commitInternal({ type: 'RESERVATION_AVAILABILITY_CLEARED' });
  }, [cancelReservationAvailability, commitInternal]);

  const refreshReservationBoundary = useCallback(async (input) => {
    const query = buildReservationAvailabilityQuery(input);
    const results = await Promise.allSettled([reloadReservations(), loadReservationAvailability(query)]);
    if (!reservationReconciliationSucceeded(results)) throw new ReservationRequestError('No se pudieron actualizar las reservas y la disponibilidad. Actualice los datos antes de reintentar.', null, true, 'reconciliation_required', true);
    commitInternal({ type: 'RESERVATION_CREATE_RECONCILED' });
    return { reservations: results[0].value, availability: results[1].value };
  }, [commitInternal, loadReservationAvailability, reloadReservations]);

  const identityKey = identityKeyFor(authStatus, account);
  useEffect(() => {
    const generation = reservationGenerationRef.current + 1;
    reservationGenerationRef.current = generation;
    availabilityGenerationRef.current += 1;
    reservationCreateGenerationRef.current += 1;
    cancelReservationLoad();
    cancelReservationAvailability();
    cancelReservationCreate();
    commitInternal({ type: 'RESERVATIONS_RESET' });
    if (authStatus !== 'authenticated' || !identityKey || !permissions.includes(PERMISSIONS.reservationsRead)) return undefined;
    const controller = new AbortController();
    reservationControllerRef.current = controller;
    runReservationLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      availabilityControllerRef.current?.abort();
      reservationCreateControllerRef.current?.abort();
      if (reservationGenerationRef.current === generation) reservationGenerationRef.current += 1;
      availabilityGenerationRef.current += 1;
      reservationCreateGenerationRef.current += 1;
    };
  }, [authStatus, cancelReservationAvailability, cancelReservationCreate, cancelReservationLoad, commitInternal, identityKey, permissions, runReservationLoad]);

  const commands = useMemo(() => createReservationCommands({
    authRef,
    commitInternal,
    reloadReservations,
    loadReservationAvailability,
    refreshReservationBoundary,
    reservationCreateGenerationRef,
    reservationCreateControllerRef,
    reservationLifecycleGenerationRef,
    reservationLifecycleControllerRef,
  }), [commitInternal, loadReservationAvailability, refreshReservationBoundary, reloadReservations]);

  return useMemo(() => ({
    reload: reloadReservations,
    availability: loadReservationAvailability,
    create: commands.create,
    detail: commands.detail,
    lifecycle: commands.lifecycle,
    clearAvailability: clearReservationAvailability,
    refreshForRetry: refreshReservationBoundary,
  }), [clearReservationAvailability, commands, loadReservationAvailability, refreshReservationBoundary, reloadReservations]);
}
