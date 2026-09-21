import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptRoomCategoryMutationResponse, adaptRoomInventoryResponse, adaptRoomMutationResponse, buildCategoryPatch, buildRoomPatch } from './roomModel.js';
import { createRoomCancellationError, getRooms, RoomRequestError, setRoomBlocked, updateRoom, updateRoomCategory } from './roomsClient.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createRoomCommands({
  authStatus,
  permissions = [],
  commitInternal,
  projectedState,
  cancelRoomRequest,
  reloadRooms,
  generationRef,
  roomControllerRef,
}) {
  const assertRoomPermission = (permission, message) => {
    if (authStatus !== 'authenticated' || !permissions.includes(permission)) throw new RoomRequestError(message, 403);
  };

  const runRoomMutation = async (request, current) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelRoomRequest();
    const controller = new AbortController();
    roomControllerRef.current = controller;
    commitInternal({ type: 'ROOM_MUTATION_STARTED' });
    try {
      const response = await request(controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) throw createRoomCancellationError();
      const room = adaptRoomMutationResponse(response, current.id);
      commitInternal({ type: 'ROOM_MUTATION_COMMITTED', room });
      return room;
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted) throw createRoomCancellationError();
      commitInternal({ type: 'ROOM_REQUEST_FAILED', error: error.message });
      if (error.reloadRecommended) reloadRooms().catch(() => {});
      throw error;
    }
  };

  const update = (roomId, input) => {
    assertRoomPermission(PERMISSIONS.roomsUpdate, 'No cuenta con permiso para editar habitaciones.');
    const current = projectedState.current.rooms.find((room) => room.id === roomId);
    if (!current) throw new RoomRequestError('La habitación ya no está disponible. Actualice la lista.', 404, true);
    const body = buildRoomPatch(current, input) ?? { number: input.number.trim(), floor: Number(input.floor), categoryId: input.categoryId };
    return runRoomMutation((signal) => updateRoom(roomId, body, signal), current);
  };

  const setBlocked = (roomId, blocked, reason) => {
    assertRoomPermission(PERMISSIONS.roomsBlock, 'No cuenta con permiso para bloquear habitaciones.');
    const current = projectedState.current.rooms.find((room) => room.id === roomId);
    if (!current) throw new RoomRequestError('La habitación ya no está disponible. Actualice la lista.', 404, true);
    return runRoomMutation((signal) => setRoomBlocked(roomId, { blocked, reason: reason.trim() }, signal), current);
  };

  const updateCategory = async (categoryId, input) => {
    assertRoomPermission(PERMISSIONS.roomsUpdate, 'No cuenta con permiso para editar categorías.');
    const current = projectedState.current.roomCategories.find((category) => category.id === categoryId);
    if (!current) throw new RoomRequestError('La categoría ya no está disponible. Actualice la lista.', 404, true);
    const body = buildCategoryPatch(current, input) ?? {
      name: input.name?.trim(),
      code: input.code?.trim(),
      capacity: input.capacity ? Number(input.capacity) : undefined,
      baseNightlyRate: input.baseNightlyRate !== undefined ? Number(input.baseNightlyRate).toFixed(2) : undefined,
    };
    commitInternal({ type: 'ROOM_MUTATION_STARTED' });
    try {
      const response = await updateRoomCategory(categoryId, body);
      const category = adaptRoomCategoryMutationResponse(response, categoryId);
      commitInternal({ type: 'ROOM_CATEGORY_UPDATED', category });
      return category;
    } catch (error) {
      commitInternal({ type: 'ROOM_REQUEST_FAILED', error: error.message });
      if (error.reloadRecommended) reloadRooms().catch(() => {});
      throw error;
    }
  };

  return { reload: reloadRooms, update, updateCategory, setBlocked };
}

export function useRoomCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const generationRef = useRef(0);
  const roomControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelRoomRequest = useCallback(() => {
    roomControllerRef.current?.abort();
    roomControllerRef.current = null;
    if (['loading', 'saving'].includes(projectedState.current.roomRequest?.status)) commitInternal({ type: 'ROOM_REQUEST_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runRoomLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'ROOMS_LOAD_STARTED' });
    try {
      const inventory = adaptRoomInventoryResponse(await getRooms(controller.signal));
      if (generation !== generationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'ROOMS_LOAD_SUCCEEDED', ...inventory });
      return inventory;
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'ROOMS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const accountIdentity = identityKeyFor(authStatus, account);
  const canReadRooms = permissions.includes(PERMISSIONS.roomsRead);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelRoomRequest();
    commitInternal({ type: 'ROOMS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadRooms) return undefined;
    const controller = new AbortController();
    roomControllerRef.current = controller;
    runRoomLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadRooms, cancelRoomRequest, commitInternal, runRoomLoad]);

  const reloadRooms = useCallback(() => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.roomsRead)) {
      return Promise.reject(new RoomRequestError('No cuenta con permiso para consultar habitaciones.', 403));
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelRoomRequest();
    const controller = new AbortController();
    roomControllerRef.current = controller;
    return runRoomLoad(generation, controller);
  }, [cancelRoomRequest, runRoomLoad]);

  return useMemo(() => createRoomCommands({
    authStatus,
    permissions,
    commitInternal,
    projectedState,
    cancelRoomRequest,
    reloadRooms,
    generationRef,
    roomControllerRef,
  }), [authStatus, cancelRoomRequest, commitInternal, permissions, projectedState, reloadRooms]);
}
