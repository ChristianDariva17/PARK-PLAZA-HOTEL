import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS, permissionForAction } from '../auth/permissions.js';
import { adaptPetResponse, buildPetCreateDto, buildPetUpdateDto } from './petsModel.js';
import { archivePet, createPet, fetchPets, PetRequestError, reactivatePet, updatePet } from './petsClient.js';
import { loadOperationalRecords, runConfirmedOperationalRequest } from '../state/operationalRequestPolicy.js';
import { validateHotelAction } from '../state/hotelReducer.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createPetCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef }) {
  const execute = async (action) => {
    const required = permissionForAction(action);
    if (!required || !(Array.isArray(required) ? required.some((permission) => authRef.current.permissions.includes(permission)) : authRef.current.permissions.includes(required))) {
      throw new PetRequestError('No cuenta con permiso para esta operación.', 403);
    }
    const validation = validateHotelAction(projectedState.current, action);
    if (!validation.ok) throw new PetRequestError(validation.error || validation.message || 'Revise los datos de la mascota.', 400);

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    requestControllerRef.current = controller;
    const result = await runConfirmedOperationalRequest({
      request: (signal) => {
        if (action.type === 'PET_CREATE') return createPet(buildPetCreateDto(projectedState.current, action.payload), signal);
        if (action.type === 'PET_UPDATE') return updatePet(action.petId, buildPetUpdateDto(action.payload), signal);
        if (action.type === 'PET_ARCHIVE') return archivePet(action.petId, action.reason, signal);
        return reactivatePet(action.petId, action.reason, signal);
      },
      adaptRecord: adaptPetResponse,
      generation,
      getCurrentGeneration: () => requestGenerationRef.current,
      signal: controller.signal,
      onCommit: (pet) => commitInternal({ type: 'PET_RECORD_COMMITTED', pet }),
      reconcile: () => loadOperationalRecords({
        fetchRecords: fetchPets,
        adaptRecord: adaptPetResponse,
        generation,
        getCurrentGeneration: () => requestGenerationRef.current,
        signal: controller.signal,
        onSuccess: (pets) => commitInternal({ type: 'PET_LOAD_SUCCEEDED', pets }),
        onFailure: (error) => commitInternal({ type: 'PET_LOAD_FAILED', error: error.message }),
      }),
    });
    if (result.status === 'superseded') throw new PetRequestError('La operación fue reemplazada por una solicitud más reciente. Actualice antes de reintentar.');
    return result.record;
  };

  return { execute };
}

export function usePetCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const loadRecords = useCallback((generation, controller) => {
    commitInternal({ type: 'PET_LOAD_STARTED' });
    return loadOperationalRecords({
      fetchRecords: fetchPets,
      adaptRecord: adaptPetResponse,
      generation,
      getCurrentGeneration: () => requestGenerationRef.current,
      signal: controller.signal,
      onSuccess: (pets) => commitInternal({ type: 'PET_LOAD_SUCCEEDED', pets }),
      onFailure: (error) => commitInternal({ type: 'PET_LOAD_FAILED', error: error.message }),
    });
  }, [commitInternal]);

  const reload = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.petsRead)) throw new PetRequestError('No cuenta con permiso para consultar las mascotas.', 403);
    requestControllerRef.current?.abort();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    return loadRecords(generation, controller);
  }, [loadRecords]);

  const identityKey = identityKeyFor(authStatus, account);
  const canRead = permissions.includes(PERMISSIONS.petsRead);
  useEffect(() => {
    requestControllerRef.current?.abort();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    commitInternal({ type: 'PET_RESET' });
    if (authStatus !== 'authenticated' || !identityKey || !canRead) return undefined;
    return () => {
      requestControllerRef.current?.abort();
      if (requestGenerationRef.current === generation) requestGenerationRef.current += 1;
    };
  }, [authStatus, canRead, commitInternal, identityKey, loadRecords]);

  const commands = useMemo(() => createPetCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef }), [commitInternal, projectedState]);
  return useMemo(() => ({ execute: commands.execute, reload }), [commands.execute, reload]);
}
