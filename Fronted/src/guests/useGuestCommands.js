import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS, permissionForAction } from '../auth/permissions.js';
import { adaptGuestResponse, buildGuestCreateDto, buildGuestPatchDto } from './guestModel.js';
import { archiveGuest, createGuest, createGuestCancellationError, getGuests, GuestRequestError, reactivateGuest, updateGuest } from './guestsClient.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createGuestCommands({
  authStatus,
  permissions = [],
  commitInternal,
  projectedState,
  cancelGuestLoad,
  reloadGuests,
  generationRef,
}) {
  const assertPermission = (action) => {
    const required = permissionForAction(action);
    if (authStatus !== 'authenticated' || !required || !permissions.includes(required)) {
      throw new GuestRequestError('No cuenta con permiso para realizar esta operación.', 403);
    }
  };

  const create = async (input) => {
    assertPermission({ type: 'CLIENT_CREATE' });
    const body = buildGuestCreateDto(input);
    cancelGuestLoad();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let response;
    try {
      response = await createGuest(body);
    } catch (error) {
      if (generation !== generationRef.current) throw createGuestCancellationError();
      throw error;
    }
    if (generation !== generationRef.current) throw createGuestCancellationError();
    const client = adaptGuestResponse(response);
    commitInternal({ type: 'GUEST_CREATED_COMMITTED', client });
    return client;
  };

  const update = async (guestId, input) => {
    assertPermission({ type: 'CLIENT_UPDATE' });
    const current = projectedState.current.clients.find((client) => client.id === guestId);
    if (!current) {
      reloadGuests().catch(() => {});
      throw new GuestRequestError('El huésped ya no está disponible. Actualice la lista antes de continuar.', 404, true);
    }
    const body = buildGuestPatchDto(current, input);
    if (!body) throw new GuestRequestError('No hay cambios para guardar.', 400);
    cancelGuestLoad();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    try {
      const response = await updateGuest(guestId, body);
      if (generation !== generationRef.current) throw createGuestCancellationError();
      const client = adaptGuestResponse(response, current);
      commitInternal({ type: 'GUEST_UPDATED_COMMITTED', client });
      return client;
    } catch (error) {
      if (generation !== generationRef.current) throw createGuestCancellationError();
      if (error.reloadRecommended) reloadGuests().catch(() => {});
      throw error;
    }
  };

  const archive = async (guestId) => {
    assertPermission({ type: 'CLIENT_ARCHIVE' });
    const current = projectedState.current.clients.find((client) => client.id === guestId);
    if (!current) {
      reloadGuests().catch(() => {});
      throw new GuestRequestError('El huésped ya no está disponible. Actualice la lista antes de continuar.', 404, true);
    }
    cancelGuestLoad();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    try {
      const response = await archiveGuest(guestId);
      if (generation !== generationRef.current) throw createGuestCancellationError();
      const client = adaptGuestResponse(response, current);
      commitInternal({ type: 'GUEST_UPDATED_COMMITTED', client });
      return client;
    } catch (error) {
      if (generation !== generationRef.current) throw createGuestCancellationError();
      if (error.reloadRecommended) reloadGuests().catch(() => {});
      throw error;
    }
  };

  const reactivate = async (guestId) => {
    assertPermission({ type: 'CLIENT_REACTIVATE' });
    const current = projectedState.current.clients.find((client) => client.id === guestId);
    if (!current) {
      reloadGuests().catch(() => {});
      throw new GuestRequestError('El huésped ya no está disponible. Actualice la lista antes de continuar.', 404, true);
    }
    cancelGuestLoad();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    try {
      const response = await reactivateGuest(guestId);
      if (generation !== generationRef.current) throw createGuestCancellationError();
      const client = adaptGuestResponse(response, current);
      commitInternal({ type: 'GUEST_UPDATED_COMMITTED', client });
      return client;
    } catch (error) {
      if (generation !== generationRef.current) throw createGuestCancellationError();
      if (error.reloadRecommended) reloadGuests().catch(() => {});
      throw error;
    }
  };

  return { reload: reloadGuests, create, update, archive, reactivate };
}

export function useGuestCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const generationRef = useRef(0);
  const loadControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelGuestLoad = useCallback(() => {
    loadControllerRef.current?.abort();
    loadControllerRef.current = null;
    if (projectedState.current.guestRequest?.status === 'loading') commitInternal({ type: 'GUESTS_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runGuestLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'GUESTS_LOAD_STARTED' });
    try {
      const response = await getGuests(controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return null;
      const localById = new Map(projectedState.current.clients.map((client) => [client.id, client]));
      const clients = response.map((guest) => adaptGuestResponse(guest, localById.get(guest.id)));
      commitInternal({ type: 'GUESTS_LOAD_SUCCEEDED', clients });
      return clients;
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'GUESTS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal, projectedState]);

  const accountIdentity = identityKeyFor(authStatus, account);
  const canReadGuests = permissions.includes(PERMISSIONS.guestsRead);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelGuestLoad();
    commitInternal({ type: 'GUESTS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadGuests) return undefined;
    const controller = new AbortController();
    loadControllerRef.current = controller;
    runGuestLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadGuests, cancelGuestLoad, commitInternal, runGuestLoad]);

  const reloadGuests = useCallback(() => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.guestsRead)) {
      return Promise.reject(new GuestRequestError('No cuenta con permiso para consultar huéspedes.', 403));
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelGuestLoad();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    return runGuestLoad(generation, controller);
  }, [cancelGuestLoad, runGuestLoad]);

  return useMemo(() => createGuestCommands({
    authStatus,
    permissions,
    commitInternal,
    projectedState,
    cancelGuestLoad,
    reloadGuests,
    generationRef,
  }), [authStatus, cancelGuestLoad, commitInternal, permissions, projectedState, reloadGuests]);
}
