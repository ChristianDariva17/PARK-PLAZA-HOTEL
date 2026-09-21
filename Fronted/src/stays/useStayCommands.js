import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptPersistentStayList, adaptStayCommandResponse, createStayIdempotencyKey } from './stayModel.js';
import { checkInReservation, checkOutStay, createStayCancellationError, getPersistentStays, StayRequestError } from './staysClient.js';
import { hasStayCheckInAccess, hasStayCheckOutAccess, isCurrentStayOperation, stayReconciliationSucceeded } from './stayRequestPolicy.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createStayCommands({
  authRef,
  commitInternal,
  cancelStayCommand,
  reloadReservations,
  reloadStays,
  reloadRooms,
  reloadCleaning,
  stayCommandGenerationRef,
  stayCommandControllerRef,
}) {
  const runStayCommand = async (access, request) => {
    const current = authRef.current;
    if (!access(current.authStatus, current.permissions)) throw new StayRequestError('No cuenta con todos los permisos necesarios para esta operación de recepción.', 403);
    const generation = stayCommandGenerationRef.current + 1;
    stayCommandGenerationRef.current = generation;
    cancelStayCommand();
    const controller = new AbortController();
    stayCommandControllerRef.current = controller;
    commitInternal({ type: 'STAY_COMMAND_STARTED' });
    try {
      const response = adaptStayCommandResponse(await request(createStayIdempotencyKey(), controller.signal));
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      commitInternal({ type: 'STAY_COMMAND_COMMITTED', ...response });
      await Promise.allSettled([reloadReservations(), reloadStays(), reloadRooms(), reloadCleaning()]);
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      return response;
    } catch (error) {
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      if (error.reloadRecommended || error.ambiguous) {
        commitInternal({ type: 'STAY_COMMAND_RECONCILING', error: error.message });
        const results = await Promise.allSettled([reloadReservations(), reloadStays(), reloadRooms(), reloadCleaning()]);
        if (!stayReconciliationSucceeded(results)) {
          commitInternal({ type: 'STAY_COMMAND_FAILED', error: 'No se pudieron recargar las reservas, estadías y habitaciones. Actualice antes de reintentar.', retryBlocked: true });
          throw new StayRequestError('No se pudo reconciliar la recepción.', null, true, 'reconciliation_required', true);
        }
      }
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      commitInternal({ type: 'STAY_COMMAND_FAILED', error: error.message, retryBlocked: false });
      throw error;
    }
  };

  return {
    checkIn: (reservationId, input = {}) => runStayCommand(hasStayCheckInAccess, (key, signal) => checkInReservation(reservationId, input, key, signal)),
    checkOut: (stayId, body = {}) => runStayCommand(hasStayCheckOutAccess, (key, signal) => checkOutStay(stayId, key, signal, body)),
  };
}

export function useStayCommands({ authStatus, account, permissions = [], commitInternal, projectedState, reloadReservations, reloadCleaning, reloadRooms }) {
  const authRef = useRef({ authStatus, account, permissions });
  const stayGenerationRef = useRef(0);
  const stayControllerRef = useRef(null);
  const stayCommandGenerationRef = useRef(0);
  const stayCommandControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelStayLoad = useCallback(() => {
    stayControllerRef.current?.abort();
    stayControllerRef.current = null;
    if (projectedState.current.stayRequest?.status === 'loading') commitInternal({ type: 'STAYS_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelStayCommand = useCallback(() => {
    stayCommandControllerRef.current?.abort();
    stayCommandControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.stayCommandRequest?.status)) commitInternal({ type: 'STAY_COMMAND_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runStayLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'STAYS_LOAD_STARTED' });
    try {
      const stays = adaptPersistentStayList(await getPersistentStays(controller.signal));
      if (!isCurrentStayOperation(generation, stayGenerationRef.current, controller.signal)) throw createStayCancellationError();
      commitInternal({ type: 'STAYS_LOAD_SUCCEEDED', stays });
      return stays;
    } catch (error) {
      if (!isCurrentStayOperation(generation, stayGenerationRef.current, controller.signal)) throw createStayCancellationError();
      if (error.status === 401) return null;
      commitInternal({ type: 'STAYS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadStays = useCallback(() => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.staysRead)) throw new StayRequestError('No cuenta con permiso para consultar estadías.', 403);
    const generation = stayGenerationRef.current + 1;
    stayGenerationRef.current = generation;
    cancelStayLoad();
    const controller = new AbortController();
    stayControllerRef.current = controller;
    return runStayLoad(generation, controller);
  }, [cancelStayLoad, runStayLoad]);

  const identityKey = identityKeyFor(authStatus, account);
  useEffect(() => {
    const generation = stayGenerationRef.current + 1;
    stayGenerationRef.current = generation;
    stayCommandGenerationRef.current += 1;
    cancelStayLoad();
    cancelStayCommand();
    commitInternal({ type: 'STAYS_RESET' });
    if (authStatus !== 'authenticated' || !identityKey || !permissions.includes(PERMISSIONS.staysRead)) return undefined;
    const controller = new AbortController();
    stayControllerRef.current = controller;
    runStayLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      stayCommandControllerRef.current?.abort();
      if (stayGenerationRef.current === generation) stayGenerationRef.current += 1;
      stayCommandGenerationRef.current += 1;
    };
  }, [authStatus, cancelStayCommand, cancelStayLoad, commitInternal, identityKey, permissions, runStayLoad]);

  const commands = useMemo(() => createStayCommands({
    authRef,
    commitInternal,
    cancelStayCommand,
    reloadReservations,
    reloadStays,
    reloadRooms,
    reloadCleaning,
    stayCommandGenerationRef,
    stayCommandControllerRef,
  }), [cancelStayCommand, commitInternal, reloadCleaning, reloadReservations, reloadRooms, reloadStays]);

  return useMemo(() => ({ reload: reloadStays, ...commands }), [commands, reloadStays]);
}
