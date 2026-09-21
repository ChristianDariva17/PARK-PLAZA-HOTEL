import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS, permissionForAction } from '../auth/permissions.js';
import { adaptVehicleResponse, buildVehicleCreateDto, buildVehicleUpdateDto } from './parkingModel.js';
import { archiveVehicle, createVehicle, exitVehicle, fetchVehicles, ParkingRequestError, updateVehicle } from './parkingClient.js';
import { loadOperationalRecords, runConfirmedOperationalRequest } from '../state/operationalRequestPolicy.js';
import { validateHotelAction } from '../state/hotelReducer.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createParkingCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef }) {
  const execute = async (action) => {
    const required = permissionForAction(action);
    if (!required || !(Array.isArray(required) ? required.some((permission) => authRef.current.permissions.includes(permission)) : authRef.current.permissions.includes(required))) {
      throw new ParkingRequestError('No cuenta con permiso para esta operación.', 403);
    }
    const validation = validateHotelAction(projectedState.current, action);
    if (!validation.ok) throw new ParkingRequestError(validation.error || validation.message || 'Revise los datos del vehículo.', 400);

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    requestControllerRef.current = controller;
    const result = await runConfirmedOperationalRequest({
      request: (signal) => {
        if (action.type === 'PARKING_CREATE') return createVehicle(buildVehicleCreateDto(projectedState.current, action), signal);
        if (action.type === 'PARKING_UPDATE') return updateVehicle(action.vehicleId, buildVehicleUpdateDto(projectedState.current, action), signal);
        if (action.type === 'PARKING_EXIT') return exitVehicle(action.vehicleId, { exitObservation: action.observation, exitResponsible: action.responsible }, signal);
        return archiveVehicle(action.vehicleId, action.reason, signal);
      },
      adaptRecord: adaptVehicleResponse,
      generation,
      getCurrentGeneration: () => requestGenerationRef.current,
      signal: controller.signal,
      onCommit: (vehicle) => commitInternal({ type: 'PARKING_RECORD_COMMITTED', vehicle }),
      reconcile: () => loadOperationalRecords({
        fetchRecords: fetchVehicles,
        adaptRecord: adaptVehicleResponse,
        generation,
        getCurrentGeneration: () => requestGenerationRef.current,
        signal: controller.signal,
        onSuccess: (vehicles) => commitInternal({ type: 'PARKING_LOAD_SUCCEEDED', vehicles }),
        onFailure: (error) => commitInternal({ type: 'PARKING_LOAD_FAILED', error: error.message }),
      }),
    });
    if (result.status === 'superseded') throw new ParkingRequestError('La operación fue reemplazada por una solicitud más reciente. Actualice antes de reintentar.');
    return result.record;
  };

  return { execute };
}

export function useParkingCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const loadRecords = useCallback((generation, controller) => {
    commitInternal({ type: 'PARKING_LOAD_STARTED' });
    return loadOperationalRecords({
      fetchRecords: fetchVehicles,
      adaptRecord: adaptVehicleResponse,
      generation,
      getCurrentGeneration: () => requestGenerationRef.current,
      signal: controller.signal,
      onSuccess: (vehicles) => commitInternal({ type: 'PARKING_LOAD_SUCCEEDED', vehicles }),
      onFailure: (error) => commitInternal({ type: 'PARKING_LOAD_FAILED', error: error.message }),
    });
  }, [commitInternal]);

  const reload = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.parkingRead)) throw new ParkingRequestError('No cuenta con permiso para consultar la cochera.', 403);
    requestControllerRef.current?.abort();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    return loadRecords(generation, controller);
  }, [loadRecords]);

  const identityKey = identityKeyFor(authStatus, account);
  const canRead = permissions.includes(PERMISSIONS.parkingRead);
  useEffect(() => {
    requestControllerRef.current?.abort();
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    commitInternal({ type: 'PARKING_RESET' });
    if (authStatus !== 'authenticated' || !identityKey || !canRead) return undefined;
    return () => {
      requestControllerRef.current?.abort();
      if (requestGenerationRef.current === generation) requestGenerationRef.current += 1;
    };
  }, [authStatus, canRead, commitInternal, identityKey, loadRecords]);

  const commands = useMemo(() => createParkingCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef }), [commitInternal, projectedState]);
  return useMemo(() => ({ execute: commands.execute, reload }), [commands.execute, reload]);
}
