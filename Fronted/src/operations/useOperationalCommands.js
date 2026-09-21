import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptCleaningCommandResponse, adaptPersistentCleaningList, mapCleaningStatusToApi } from '../cleaning/cleaningModel.js';
import { CleaningRequestError, createCleaningCancellationError, createCleaningIdempotencyKey, createCleaningTask, getCleaningTasks, progressCleaningTask, reportCleaningIncident, updateCleaningTask } from '../cleaning/cleaningClient.js';
import { adaptIncidentList } from '../incidents/incidentsModel.js';
import { createIncident, getIncidents, IncidentRequestError, progressIncident, updateIncident } from '../incidents/incidentsClient.js';
import { adaptMaintenanceList } from '../maintenance/maintenanceModel.js';
import { createMaintenanceCancellationError, createMaintenanceTicket, getMaintenanceTickets, MaintenanceRequestError, progressMaintenanceTicket, updateMaintenanceTicket } from '../maintenance/maintenanceClient.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createOperationalCommands({ authRef, commitInternal, cancelCleaningCommand, cancelMaintenanceCommand, reloadCleaning, reloadIncidents, reloadMaintenance, reloadRooms }) {
  const runCleaningCommand = async (permission, request) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new CleaningRequestError('No cuenta con permiso para esta operación de limpieza.', 403);
    const generation = authRef.current.cleaningCommandGenerationRef.current + 1;
    authRef.current.cleaningCommandGenerationRef.current = generation;
    cancelCleaningCommand();
    const controller = new AbortController();
    authRef.current.cleaningCommandControllerRef.current = controller;
    commitInternal({ type: 'CLEANING_COMMAND_STARTED' });
    try {
      const response = adaptCleaningCommandResponse(await request(createCleaningIdempotencyKey(), controller.signal));
      if (generation !== authRef.current.cleaningCommandGenerationRef.current || controller.signal.aborted) throw createCleaningCancellationError();
      commitInternal({ type: 'CLEANING_COMMAND_COMMITTED', ...response });
      await Promise.allSettled([
        Promise.resolve().then(reloadCleaning),
        Promise.resolve().then(reloadRooms),
        Promise.resolve().then(reloadIncidents),
      ]);
      if (generation !== authRef.current.cleaningCommandGenerationRef.current || controller.signal.aborted) throw createCleaningCancellationError();
      return response.task;
    } catch (error) {
      if (generation !== authRef.current.cleaningCommandGenerationRef.current || controller.signal.aborted) throw createCleaningCancellationError();
      if (error.reloadRecommended || error.ambiguous) {
        commitInternal({ type: 'CLEANING_COMMAND_RECONCILING', error: error.message });
        try {
          await reloadCleaning();
        } catch (reconciliationError) {
          if (generation !== authRef.current.cleaningCommandGenerationRef.current || controller.signal.aborted) throw createCleaningCancellationError();
          commitInternal({
            type: 'CLEANING_COMMAND_FAILED',
            error: reconciliationError.message,
            retryBlocked: true,
          });
          throw reconciliationError;
        }
        if (generation !== authRef.current.cleaningCommandGenerationRef.current || controller.signal.aborted) throw createCleaningCancellationError();
      }
      commitInternal({ type: 'CLEANING_COMMAND_FAILED', error: error.message, retryBlocked: false });
      throw error;
    }
  };

  const createCleaningTaskCommand = (roomId, reason, observation, assignedTo) => runCleaningCommand(PERMISSIONS.cleaningAssign, (key, signal) => createCleaningTask({ roomId, reason, observation, assignedTo }, key, signal));
  const updateCleaningCommand = (taskId, assignedTo, observation, evidence) => runCleaningCommand(PERMISSIONS.cleaningAssign, (key, signal) => updateCleaningTask(taskId, { assignedTo, observation, evidence }, key, signal));
  const progressCleaningCommand = (taskId, expectedStatus, evidence) => runCleaningCommand(PERMISSIONS.cleaningProgress, (key, signal) => progressCleaningTask(taskId, { expectedStatus: mapCleaningStatusToApi(expectedStatus), evidence }, key, signal));
  const reportCleaningIncidentCommand = (taskId, description, evidence, responsible, blocksRoom) => runCleaningCommand(PERMISSIONS.cleaningReportIncident, (key, signal) => reportCleaningIncident(taskId, { description, evidence, responsible, blocksRoom }, key, signal));
  const refreshCleaningForRetry = async () => {
    const tasks = await reloadCleaning();
    commitInternal({ type: 'CLEANING_COMMAND_RECONCILED' });
    return tasks;
  };

  const runCommandWithPermission = async (permission, request, errorType, message) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new errorType(message, 403);
    return request();
  };

  const createIncidentCommand = (body) => runCommandWithPermission(PERMISSIONS.incidentsCreate, async () => {
    const response = await createIncident(body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_CREATED', incident: adapted[0] });
    return adapted[0];
  }, IncidentRequestError, 'No cuenta con permiso para crear incidencias.');

  const updateIncidentCommand = (id, body) => runCommandWithPermission(PERMISSIONS.incidentsUpdate, async () => {
    const response = await updateIncident(id, body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_UPDATED', incident: adapted[0] });
    return adapted[0];
  }, IncidentRequestError, 'No cuenta con permiso para actualizar incidencias.');

  const progressIncidentCommand = (id, body) => runCommandWithPermission(PERMISSIONS.incidentsProgress, async () => {
    const response = await progressIncident(id, body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_UPDATED', incident: adapted[0] });
    return adapted[0];
  }, IncidentRequestError, 'No cuenta con permiso para avanzar incidencias.');

  const runMaintenanceCommand = async (permission, request) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new MaintenanceRequestError('No cuenta con permiso para realizar esta operación de mantenimiento.', 403);
    const generation = authRef.current.maintenanceCommandGenerationRef.current + 1;
    authRef.current.maintenanceCommandGenerationRef.current = generation;
    cancelMaintenanceCommand();
    const controller = new AbortController();
    authRef.current.maintenanceCommandControllerRef.current = controller;
    commitInternal({ type: 'MAINTENANCE_COMMAND_STARTED' });
    try {
      const response = await request(controller.signal);
      if (generation !== authRef.current.maintenanceCommandGenerationRef.current || controller.signal.aborted) throw createMaintenanceCancellationError();
      const ticket = adaptMaintenanceList([response])[0];
      const incident = adaptIncidentList([response])[0];
      commitInternal({ type: 'MAINTENANCE_COMMAND_COMMITTED', ticket, incident });
      await Promise.allSettled([
        Promise.resolve().then(reloadMaintenance),
        Promise.resolve().then(reloadRooms),
        Promise.resolve().then(reloadIncidents),
      ]);
      if (generation !== authRef.current.maintenanceCommandGenerationRef.current || controller.signal.aborted) throw createMaintenanceCancellationError();
      return ticket;
    } catch (error) {
      if (generation !== authRef.current.maintenanceCommandGenerationRef.current || controller.signal.aborted) throw createMaintenanceCancellationError();
      if (error.reloadRecommended || error.ambiguous) {
        commitInternal({ type: 'MAINTENANCE_COMMAND_RECONCILING', error: error.message });
        try {
          await reloadMaintenance();
        } catch (reconciliationError) {
          if (generation !== authRef.current.maintenanceCommandGenerationRef.current || controller.signal.aborted) throw createMaintenanceCancellationError();
          commitInternal({ type: 'MAINTENANCE_COMMAND_FAILED', error: reconciliationError.message, retryBlocked: true });
          throw reconciliationError;
        }
        if (generation !== authRef.current.maintenanceCommandGenerationRef.current || controller.signal.aborted) throw createMaintenanceCancellationError();
      }
      commitInternal({ type: 'MAINTENANCE_COMMAND_FAILED', error: error.message, retryBlocked: false });
      throw error;
    }
  };

  const refreshMaintenanceForRetry = async () => {
    const tickets = await reloadMaintenance();
    await Promise.allSettled([Promise.resolve().then(reloadRooms), Promise.resolve().then(reloadIncidents)]);
    commitInternal({ type: 'MAINTENANCE_COMMAND_RECONCILED' });
    return tickets;
  };

  const createMaintenanceMutation = (body) => runMaintenanceCommand(PERMISSIONS.maintenanceCreate, (signal) => createMaintenanceTicket(body, signal));
  const updateMaintenanceCommand = (id, body) => runMaintenanceCommand(PERMISSIONS.maintenanceUpdate, (signal) => updateMaintenanceTicket(id, body, signal));

  const progressMaintenanceCommand = (id, body) => runMaintenanceCommand(PERMISSIONS.maintenanceProgress, (signal) => progressMaintenanceTicket(id, body, signal));

  return {
    cleaningCommands: { reload: reloadCleaning, refreshForRetry: refreshCleaningForRetry, create: createCleaningTaskCommand, update: updateCleaningCommand, progress: progressCleaningCommand, reportIncident: reportCleaningIncidentCommand },
    incidentCommands: { reload: reloadIncidents, create: createIncidentCommand, update: updateIncidentCommand, progress: progressIncidentCommand },
    maintenanceCommands: { reload: reloadMaintenance, refreshForRetry: refreshMaintenanceForRetry, create: createMaintenanceMutation, update: updateMaintenanceCommand, progress: progressMaintenanceCommand },
  };
}

export function useOperationalCommands({ authStatus, account, permissions = [], commitInternal, projectedState, reloadRooms }) {
  const authRef = useRef({ authStatus, account, permissions });
  const cleaningGenerationRef = useRef(0);
  const cleaningControllerRef = useRef(null);
  const cleaningCommandGenerationRef = useRef(0);
  const cleaningCommandControllerRef = useRef(null);
  const maintenanceCommandGenerationRef = useRef(0);
  const maintenanceCommandControllerRef = useRef(null);
  const incidentGenerationRef = useRef(0);
  const incidentControllerRef = useRef(null);
  const maintenanceGenerationRef = useRef(0);
  const maintenanceControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions, cleaningCommandGenerationRef, cleaningCommandControllerRef, maintenanceCommandGenerationRef, maintenanceCommandControllerRef };
  }, [account, authStatus, permissions]);

  const cancelCleaningLoad = useCallback(() => {
    cleaningControllerRef.current?.abort();
    cleaningControllerRef.current = null;
    if (projectedState.current.cleaningRequest?.status === 'loading') commitInternal({ type: 'CLEANING_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelCleaningCommand = useCallback(() => {
    cleaningCommandControllerRef.current?.abort();
    cleaningCommandControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.cleaningCommandRequest?.status)) commitInternal({ type: 'CLEANING_COMMAND_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelIncidentLoad = useCallback(() => {
    incidentControllerRef.current?.abort();
    incidentControllerRef.current = null;
    if (projectedState.current.incidentRequest?.status === 'loading') commitInternal({ type: 'INCIDENTS_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelMaintenanceLoad = useCallback(() => {
    maintenanceControllerRef.current?.abort();
    maintenanceControllerRef.current = null;
    if (projectedState.current.maintenanceRequest?.status === 'loading') commitInternal({ type: 'MAINTENANCE_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const cancelMaintenanceCommand = useCallback(() => {
    maintenanceCommandControllerRef.current?.abort();
    maintenanceCommandControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.maintenanceCommandRequest?.status)) commitInternal({ type: 'MAINTENANCE_COMMAND_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runCleaningLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'CLEANING_LOAD_STARTED' });
    try {
      const cleaningTasks = adaptPersistentCleaningList(await getCleaningTasks(controller.signal));
      if (generation !== cleaningGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'CLEANING_LOAD_SUCCEEDED', cleaningTasks });
      return cleaningTasks;
    } catch (error) {
      if (generation !== cleaningGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'CLEANING_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const runIncidentLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'INCIDENTS_LOAD_STARTED' });
    try {
      const incidents = adaptIncidentList(await getIncidents(controller.signal));
      if (generation !== incidentGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'INCIDENTS_LOAD_SUCCEEDED', incidents });
      return incidents;
    } catch (error) {
      if (generation !== incidentGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'INCIDENTS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const runMaintenanceLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'MAINTENANCE_LOAD_STARTED' });
    try {
      const maintenanceTickets = adaptMaintenanceList(await getMaintenanceTickets(controller.signal));
      if (generation !== maintenanceGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'MAINTENANCE_LOAD_SUCCEEDED', maintenanceTickets });
      return maintenanceTickets;
    } catch (error) {
      if (generation !== maintenanceGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'MAINTENANCE_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadCleaning = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.cleaningRead)) return Promise.reject(new CleaningRequestError('No cuenta con permiso para consultar limpieza.', 403));
    const generation = cleaningGenerationRef.current + 1;
    cleaningGenerationRef.current = generation;
    cancelCleaningLoad();
    const controller = new AbortController();
    cleaningControllerRef.current = controller;
    return runCleaningLoad(generation, controller);
  }, [cancelCleaningLoad, runCleaningLoad]);

  const reloadIncidents = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.incidentsRead)) throw new IncidentRequestError('No cuenta con permiso para consultar incidencias.', 403);
    const generation = incidentGenerationRef.current + 1;
    incidentGenerationRef.current = generation;
    cancelIncidentLoad();
    const controller = new AbortController();
    incidentControllerRef.current = controller;
    return runIncidentLoad(generation, controller);
  }, [cancelIncidentLoad, runIncidentLoad]);

  const reloadMaintenance = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.maintenanceRead)) throw new MaintenanceRequestError('No cuenta con permiso para consultar mantenimiento.', 403);
    const generation = maintenanceGenerationRef.current + 1;
    maintenanceGenerationRef.current = generation;
    cancelMaintenanceLoad();
    const controller = new AbortController();
    maintenanceControllerRef.current = controller;
    return runMaintenanceLoad(generation, controller);
  }, [cancelMaintenanceLoad, runMaintenanceLoad]);

  const commands = useMemo(() => createOperationalCommands({ authRef, commitInternal, cancelCleaningCommand, cancelMaintenanceCommand, reloadCleaning, reloadIncidents, reloadMaintenance, reloadRooms }), [cancelCleaningCommand, cancelMaintenanceCommand, commitInternal, reloadCleaning, reloadIncidents, reloadMaintenance, reloadRooms]);
  const { cleaningCommands, incidentCommands, maintenanceCommands } = commands;

  const identityKey = identityKeyFor(authStatus, account);
  const canReadCleaning = permissions.includes(PERMISSIONS.cleaningRead);
  const canReadIncidents = permissions.includes(PERMISSIONS.incidentsRead);
  const canReadMaintenance = permissions.includes(PERMISSIONS.maintenanceRead);
  useEffect(() => {
    const cleaningGeneration = cleaningGenerationRef.current + 1;
    cleaningGenerationRef.current = cleaningGeneration;
    cleaningCommandGenerationRef.current += 1;
    maintenanceCommandGenerationRef.current += 1;
    const incidentGeneration = incidentGenerationRef.current + 1;
    incidentGenerationRef.current = incidentGeneration;
    const maintenanceGeneration = maintenanceGenerationRef.current + 1;
    maintenanceGenerationRef.current = maintenanceGeneration;
    cancelCleaningLoad();
    cancelCleaningCommand();
    cancelMaintenanceCommand();
    cancelIncidentLoad();
    cancelMaintenanceLoad();
    commitInternal({ type: 'CLEANING_RESET' });
    commitInternal({ type: 'INCIDENTS_RESET' });
    commitInternal({ type: 'MAINTENANCE_RESET' });
    if (authStatus !== 'authenticated' || !identityKey) return undefined;

    const controllers = {
      cleaning: new AbortController(),
      incidents: new AbortController(),
      maintenance: new AbortController(),
    };
    if (canReadCleaning) {
      cleaningControllerRef.current = controllers.cleaning;
      runCleaningLoad(cleaningGeneration, controllers.cleaning).catch(() => {});
    }
    if (canReadIncidents) {
      incidentControllerRef.current = controllers.incidents;
      runIncidentLoad(incidentGeneration, controllers.incidents).catch(() => {});
    }
    if (canReadMaintenance) {
      maintenanceControllerRef.current = controllers.maintenance;
      runMaintenanceLoad(maintenanceGeneration, controllers.maintenance).catch(() => {});
    }
    return () => {
      Object.values(controllers).forEach((controller) => controller.abort());
      cleaningCommandControllerRef.current?.abort();
      maintenanceCommandControllerRef.current?.abort();
      cleaningCommandGenerationRef.current += 1;
      maintenanceCommandGenerationRef.current += 1;
      if (cleaningGenerationRef.current === cleaningGeneration) cleaningGenerationRef.current += 1;
      if (incidentGenerationRef.current === incidentGeneration) incidentGenerationRef.current += 1;
      if (maintenanceGenerationRef.current === maintenanceGeneration) maintenanceGenerationRef.current += 1;
    };
  }, [authStatus, canReadCleaning, canReadIncidents, canReadMaintenance, cancelCleaningCommand, cancelCleaningLoad, cancelIncidentLoad, cancelMaintenanceCommand, cancelMaintenanceLoad, commitInternal, identityKey, runCleaningLoad, runIncidentLoad, runMaintenanceLoad]);

  return useMemo(() => ({ cleaningCommands, incidentCommands, maintenanceCommands }), [cleaningCommands, incidentCommands, maintenanceCommands]);
}
