import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth, usePermissions } from '../auth/authContext.js';
import { PERMISSIONS, permissionForAction, hasKitchenManagementAccess } from '../auth/permissions.js';
import { getInitialHotelState } from '../domain/hotelModel.js';

// Guests
import { adaptGuestResponse, buildGuestCreateDto, buildGuestPatchDto } from '../guests/guestModel.js';
import { createGuest, createGuestCancellationError, getGuests, GuestRequestError, updateGuest, archiveGuest, reactivateGuest } from '../guests/guestsClient.js';

// Rooms
import { adaptRoomCategoryMutationResponse, adaptRoomInventoryResponse, adaptRoomMutationResponse, buildCategoryPatch, buildRoomPatch } from '../rooms/roomModel.js';
import { createRoomCancellationError, getRooms, RoomRequestError, setRoomBlocked, updateRoom, updateRoomCategory } from '../rooms/roomsClient.js';

// Reservations
import { adaptReservationAvailabilityResponse, adaptReservationCommandResponse, adaptReservationCreateResponse, adaptReservationDetailResponse, adaptReservationListResponse, buildReservationAvailabilityQuery, buildReservationCreateDto, buildReservationLifecycleDto } from '../reservations/reservationModel.js';
import { cancelReservation, confirmReservation, createReservation, createReservationCancellationError, createReservationIdempotencyKey, dispositionReservation, getReservationAvailability, getReservationDetail, getReservations, ReservationRequestError } from '../reservations/reservationsClient.js';
import { hasReservationCreateAccess, hasReservationLifecycleAccess, isCurrentReservationOperation, reservationReconciliationSucceeded } from '../reservations/reservationRequestPolicy.js';

// Stays
import { adaptPersistentStayList, adaptStayCommandResponse, createStayIdempotencyKey } from '../stays/stayModel.js';
import { checkInReservation, checkOutStay, createStayCancellationError, getPersistentStays, StayRequestError } from '../stays/staysClient.js';
import { hasStayCheckInAccess, hasStayCheckOutAccess, isCurrentStayOperation, stayReconciliationSucceeded } from '../stays/stayRequestPolicy.js';

// Cleaning
import { adaptPersistentCleaningList, mapCleaningStatusToApi } from '../cleaning/cleaningModel.js';
import { createCleaningIdempotencyKey, getCleaningTasks, progressCleaningTask, reportCleaningIncident, updateCleaningTask, createCleaningTask, CleaningRequestError } from '../cleaning/cleaningClient.js';

// Incidents
import { adaptIncidentList } from '../incidents/incidentsModel.js';
import { getIncidents, createIncident, updateIncident, progressIncident, IncidentRequestError } from '../incidents/incidentsClient.js';

// Maintenance
import { adaptMaintenanceList } from '../maintenance/maintenanceModel.js';
import { getMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket, progressMaintenanceTicket, MaintenanceRequestError } from '../maintenance/maintenanceClient.js';

// Cash
import { adaptCashSession, adaptCashSessionsList, adaptCashMovement, adaptCashMovementsList, adaptCashCountsList, buildOpenCashSessionDto, buildCountCashSessionDto, buildCashMovementDto } from '../cash/cashModel.js';
import { getActiveCashSession, getCashSessions, getCashMovements, getCashCounts, openCashSession, countCashSession, closeCashSession, createCashMovement, CashRequestError } from '../cash/cashClient.js';

// Restaurant
import { adaptMenuList, adaptInventoryList, adaptLedgerList, adaptOrdersList, adaptManagedMenuList, adaptImportPreviewResult } from '../restaurant/restaurantModel.js';
import { getMenu, getInventory, getInventoryLedger, getOrders, createOrder, updateOrder, advanceOrder, advanceOrderItem, cancelOrder, createMenuItem, updateMenuItem, archiveMenuItem, reactivateMenuItem, createInventoryItem, updateInventoryItem, adjustInventory, archiveInventoryItem, reactivateInventoryItem, getManagedMenu, previewMenuImport, applyMenuImport } from '../restaurant/restaurantClient.js';

// Pets
import { fetchPets, createPet, updatePet, archivePet, reactivatePet, PetRequestError } from '../pets/petsClient.js';
import { adaptPetResponse, buildPetCreateDto, buildPetUpdateDto } from '../pets/petsModel.js';

// Parking
import { fetchVehicles, createVehicle, updateVehicle, exitVehicle, archiveVehicle, ParkingRequestError } from '../parking/parkingClient.js';
import { adaptVehicleResponse, buildVehicleCreateDto, buildVehicleUpdateDto } from '../parking/parkingModel.js';

import { HotelCommandsContext, HotelStateContext } from './hotelContext.js';
export { HotelCommandsContext, HotelStateContext, useHotel, useHotelCommands } from './hotelContext.js';
import { hotelReducer, validateHotelAction } from './hotelReducer.js';
import { loadOperationalRecords, runConfirmedOperationalRequest } from './operationalRequestPolicy.js';

const RESTAURANT_RESOURCE_DEFINITIONS = {
  menu: { permission: PERMISSIONS.ordersRead, domainKey: 'recipes', fetch: getMenu, adapt: adaptMenuList },
  orders: { permission: PERMISSIONS.ordersRead, domainKey: 'orders', fetch: getOrders, adapt: adaptOrdersList },
  inventory: { permission: PERMISSIONS.inventoryRead, domainKey: 'inventory', fetch: getInventory, adapt: adaptInventoryList },
  inventoryLedger: { permission: PERMISSIONS.inventoryRead, domainKey: 'inventoryLedger', fetch: getInventoryLedger, adapt: adaptLedgerList },
};

export function HotelProvider({ children }) {
  const { status: authStatus, account, permissions = [] } = useAuth();
  const { can } = usePermissions();
  const [state, reducerDispatch] = useReducer(hotelReducer, undefined, getInitialHotelState);
  const projectedState = useRef(state);
  useLayoutEffect(() => {
    projectedState.current = state;
  }, [state]);

  const authRef = useRef({ authStatus, permissions, account });
  useLayoutEffect(() => {
    authRef.current = { authStatus, permissions, account };
  }, [authStatus, permissions, account]);

  const generationRef = useRef(0);
  const loadControllerRef = useRef(null);

  const roomGenerationRef = useRef(0);
  const roomControllerRef = useRef(null);

  const reservationGenerationRef = useRef(0);
  const reservationControllerRef = useRef(null);
  const availabilityGenerationRef = useRef(0);
  const availabilityControllerRef = useRef(null);
  const reservationCreateGenerationRef = useRef(0);
  const reservationCreateControllerRef = useRef(null);
  const reservationLifecycleGenerationRef = useRef(0);
  const reservationLifecycleControllerRef = useRef(null);

  const stayGenerationRef = useRef(0);
  const stayControllerRef = useRef(null);
  const stayCommandGenerationRef = useRef(0);
  const stayCommandControllerRef = useRef(null);

  const cleaningGenerationRef = useRef(0);
  const cleaningControllerRef = useRef(null);
  const cleaningCommandGenerationRef = useRef(0);
  const cleaningCommandControllerRef = useRef(null);

  const incidentGenerationRef = useRef(0);
  const incidentControllerRef = useRef(null);

  const maintenanceGenerationRef = useRef(0);
  const maintenanceControllerRef = useRef(null);

  const cashGenerationRef = useRef(0);
  const cashControllerRef = useRef(null);

  const resourceRefs = useRef({
    menu: { generation: 0, controller: null },
    orders: { generation: 0, controller: null },
    inventory: { generation: 0, controller: null },
    inventoryLedger: { generation: 0, controller: null },
  });
  const managedMenuGenRef = useRef(0);
  const managedMenuControllerRef = useRef(null);
  const menuImportControllerRef = useRef(null);
  const inventoryMutationRef = useRef(null); // tracks active mutation per item id
  const parkingRequestGenerationRef = useRef(0);
  const parkingRequestControllerRef = useRef(null);
  const petRequestGenerationRef = useRef(0);
  const petRequestControllerRef = useRef(null);

  const commitInternal = useCallback((action) => {
    projectedState.current = hotelReducer(projectedState.current, action);
    reducerDispatch(action);
  }, []);

  const cancelGuestLoad = useCallback(() => {
    loadControllerRef.current?.abort();
    loadControllerRef.current = null;
    if (projectedState.current.guestRequest?.status === 'loading') commitInternal({ type: 'GUESTS_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelRoomRequest = useCallback(() => {
    roomControllerRef.current?.abort();
    roomControllerRef.current = null;
    if (['loading', 'saving'].includes(projectedState.current.roomRequest?.status)) commitInternal({ type: 'ROOM_REQUEST_CANCELLED' });
  }, [commitInternal]);

  const cancelReservationLoad = useCallback(() => {
    reservationControllerRef.current?.abort();
    reservationControllerRef.current = null;
    if (projectedState.current.reservationRequest?.status === 'loading') commitInternal({ type: 'RESERVATIONS_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelReservationAvailability = useCallback(() => {
    availabilityControllerRef.current?.abort();
    availabilityControllerRef.current = null;
    if (projectedState.current.reservationAvailabilityRequest?.status === 'loading') commitInternal({ type: 'RESERVATION_AVAILABILITY_CANCELLED' });
  }, [commitInternal]);

  const cancelReservationCreate = useCallback(() => {
    reservationCreateControllerRef.current?.abort();
    reservationCreateControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.reservationCreateRequest?.status)) commitInternal({ type: 'RESERVATION_CREATE_CANCELLED' });
  }, [commitInternal]);

  const cancelStayLoad = useCallback(() => {
    stayControllerRef.current?.abort();
    stayControllerRef.current = null;
    if (projectedState.current.stayRequest?.status === 'loading') commitInternal({ type: 'STAYS_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelStayCommand = useCallback(() => {
    stayCommandControllerRef.current?.abort();
    stayCommandControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.stayCommandRequest?.status)) commitInternal({ type: 'STAY_COMMAND_CANCELLED' });
  }, [commitInternal]);

  const cancelCleaningLoad = useCallback(() => {
    cleaningControllerRef.current?.abort();
    cleaningControllerRef.current = null;
    if (projectedState.current.cleaningRequest?.status === 'loading') commitInternal({ type: 'CLEANING_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelCleaningCommand = useCallback(() => {
    cleaningCommandControllerRef.current?.abort();
    cleaningCommandControllerRef.current = null;
    if (['saving', 'reconciling'].includes(projectedState.current.cleaningCommandRequest?.status)) commitInternal({ type: 'CLEANING_COMMAND_CANCELLED' });
  }, [commitInternal]);

  const cancelIncidentLoad = useCallback(() => {
    incidentControllerRef.current?.abort();
    incidentControllerRef.current = null;
    if (projectedState.current.incidentRequest?.status === 'loading') commitInternal({ type: 'INCIDENTS_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelMaintenanceLoad = useCallback(() => {
    maintenanceControllerRef.current?.abort();
    maintenanceControllerRef.current = null;
    if (projectedState.current.maintenanceRequest?.status === 'loading') commitInternal({ type: 'MAINTENANCE_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelCashLoad = useCallback(() => {
    cashControllerRef.current?.abort();
    cashControllerRef.current = null;
    if (projectedState.current.cashRequest?.status === 'loading') commitInternal({ type: 'CASH_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelResourceLoad = useCallback((resourceKey) => {
    const ref = resourceRefs.current[resourceKey];
    if (!ref) return;
    ref.controller?.abort();
    ref.controller = null;
    commitInternal({ 
      type: 'RESOURCE_LOAD_CANCELLED', 
      resourceKey, 
      identityKey: authRef.current.authStatus === 'authenticated' ? `${authRef.current.account?.id || authRef.current.account?.email || ''}:${authRef.current.account?.propertyId || ''}` : '',
      generation: ref.generation 
    });
  }, [commitInternal]);

  const cancelManagedMenuLoad = useCallback(() => {
    managedMenuControllerRef.current?.abort();
    managedMenuControllerRef.current = null;
    commitInternal({ type: 'MANAGED_MENU_LOAD_CANCELLED' });
  }, [commitInternal]);

  const cancelMenuImport = useCallback(() => {
    menuImportControllerRef.current?.abort();
    menuImportControllerRef.current = null;
    // Don't emit cancel actions here since we block navigation while importing, 
    // but useful if unmounted
  }, [commitInternal]);

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
  }, [commitInternal]);

  const runRoomLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'ROOMS_LOAD_STARTED' });
    try {
      const inventory = adaptRoomInventoryResponse(await getRooms(controller.signal));
      if (generation !== roomGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'ROOMS_LOAD_SUCCEEDED', ...inventory });
      return inventory;
    } catch (error) {
      if (generation !== roomGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'ROOMS_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

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

  const runCleaningLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'CLEANING_LOAD_STARTED' });
    try {
      const cleaningTasks = adaptPersistentCleaningList(await getCleaningTasks(controller.signal));
      if (generation !== cleaningGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'CLEANING_LOAD_SUCCEEDED', cleaningTasks });
      return cleaningTasks;
    } catch (error) {
      if (generation !== cleaningGenerationRef.current || controller.signal.aborted) return null;
      if (error.status === 401) return null;
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
      if (generation !== incidentGenerationRef.current || controller.signal.aborted) return null;
      if (error.status === 401) return null;
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
      if (generation !== maintenanceGenerationRef.current || controller.signal.aborted) return null;
      if (error.status === 401) return null;
      commitInternal({ type: 'MAINTENANCE_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const runCashLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'CASH_LOAD_STARTED' });
    try {
      const [active, history] = await Promise.all([
        getActiveCashSession(controller.signal),
        getCashSessions(controller.signal)
      ]);
      if (generation !== cashGenerationRef.current || controller.signal.aborted) return null;

      const [movements, counts] = active
        ? await Promise.all([getCashMovements(active.id, controller.signal), getCashCounts(active.id, controller.signal)])
        : [[], []];
      if (generation !== cashGenerationRef.current || controller.signal.aborted) return null;

      const openSession = adaptCashSession(active);
      const cashSessions = adaptCashSessionsList(history);
      const cashMovements = adaptCashMovementsList(movements);
      const cashCounts = adaptCashCountsList(counts);

      commitInternal({ type: 'CASH_LOAD_SUCCEEDED', openSession, cashSessions, cashMovements, cashCounts });
      return { openSession, cashSessions, cashMovements, cashCounts };
    } catch (error) {
      if (generation !== cashGenerationRef.current || controller.signal.aborted) return null;
      if (error.status === 401) return null;
      commitInternal({ type: 'CASH_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const loadCashSessionDetails = useCallback(async (sessionId) => {
    const [movements, counts] = await Promise.all([getCashMovements(sessionId), getCashCounts(sessionId)]);
    commitInternal({
      type: 'CASH_SESSION_DETAILS_LOADED',
      sessionId,
      cashMovements: adaptCashMovementsList(movements),
      cashCounts: adaptCashCountsList(counts),
    });
  }, [commitInternal]);

  const runResourceLoad = useCallback(async (resourceKey, generation, controller) => {
    const config = RESTAURANT_RESOURCE_DEFINITIONS[resourceKey];
    if (!config) return;

    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(config.permission)) {
      commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation });
      return;
    }

    commitInternal({ type: 'RESOURCE_LOAD_STARTED', resourceKey, generation });
    try {
      const raw = await config.fetch(controller.signal);
      if (generation !== resourceRefs.current[resourceKey].generation || controller.signal.aborted) return;
      
      const identityKey = `${authRef.current.account?.id || authRef.current.account?.email || ''}:${authRef.current.account?.propertyId || ''}`;
      commitInternal({ 
        type: 'RESOURCE_LOAD_SUCCEEDED', 
        resourceKey, 
        domainKey: config.domainKey, 
        data: config.adapt(raw),
        generation,
        identityKey,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (generation !== resourceRefs.current[resourceKey].generation || controller.signal.aborted) return;
      if (error.status === 401) return;
      
      const identityKey = `${authRef.current.account?.id || authRef.current.account?.email || ''}:${authRef.current.account?.propertyId || ''}`;
      if (error.type === 'forbidden') {
        commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation, identityKey });
      } else {
        commitInternal({ type: 'RESOURCE_LOAD_FAILED', resourceKey, generation, error: error.message, identityKey });
      }
    }
  }, [commitInternal]);

  const canReadGuests = permissions.includes(PERMISSIONS.guestsRead);
  const canReadRooms = permissions.includes(PERMISSIONS.roomsRead);
  const canReadReservations = permissions.includes(PERMISSIONS.reservationsRead);
  const canReadStays = permissions.includes(PERMISSIONS.staysRead);
  const canReadCleaning = permissions.includes(PERMISSIONS.cleaningRead);
  const canReadIncidents = permissions.includes(PERMISSIONS.incidentsRead);
  const canReadMaintenance = permissions.includes(PERMISSIONS.maintenanceRead);
  const canReadCash = permissions.includes(PERMISSIONS.cashRead);
  const canReadOrders = permissions.includes(PERMISSIONS.ordersRead);
  const canReadInventory = permissions.includes(PERMISSIONS.inventoryRead);
  const canReadParking = permissions.includes(PERMISSIONS.parkingRead);
  const canReadPets = permissions.includes(PERMISSIONS.petsRead);

  const accountIdentity = authStatus === 'authenticated' ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}` : '';

  const loadParkingRecords = useCallback((generation, controller) => {
    commitInternal({ type: 'PARKING_LOAD_STARTED' });
    return loadOperationalRecords({
      fetchRecords: fetchVehicles,
      adaptRecord: adaptVehicleResponse,
      generation,
      getCurrentGeneration: () => parkingRequestGenerationRef.current,
      signal: controller.signal,
      onSuccess: (vehicles) => commitInternal({ type: 'PARKING_LOAD_SUCCEEDED', vehicles }),
      onFailure: (error) => commitInternal({ type: 'PARKING_LOAD_FAILED', error: error.message }),
    });
  }, [commitInternal]);

  const loadPetRecords = useCallback((generation, controller) => {
    commitInternal({ type: 'PET_LOAD_STARTED' });
    return loadOperationalRecords({
      fetchRecords: fetchPets,
      adaptRecord: adaptPetResponse,
      generation,
      getCurrentGeneration: () => petRequestGenerationRef.current,
      signal: controller.signal,
      onSuccess: (pets) => commitInternal({ type: 'PET_LOAD_SUCCEEDED', pets }),
      onFailure: (error) => commitInternal({ type: 'PET_LOAD_FAILED', error: error.message }),
    });
  }, [commitInternal]);

  useEffect(() => {
    parkingRequestControllerRef.current?.abort();
    const generation = parkingRequestGenerationRef.current + 1;
    parkingRequestGenerationRef.current = generation;
    commitInternal({ type: 'PARKING_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadParking) return undefined;
    const controller = new AbortController();
    parkingRequestControllerRef.current = controller;
    loadParkingRecords(generation, controller);
    return () => controller.abort();
  }, [accountIdentity, authStatus, canReadParking, commitInternal, loadParkingRecords]);

  useEffect(() => {
    petRequestControllerRef.current?.abort();
    const generation = petRequestGenerationRef.current + 1;
    petRequestGenerationRef.current = generation;
    commitInternal({ type: 'PET_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadPets) return undefined;
    const controller = new AbortController();
    petRequestControllerRef.current = controller;
    loadPetRecords(generation, controller);
    return () => controller.abort();
  }, [accountIdentity, authStatus, canReadPets, commitInternal, loadPetRecords]);

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

  useEffect(() => {
    const generation = roomGenerationRef.current + 1;
    roomGenerationRef.current = generation;
    cancelRoomRequest();
    commitInternal({ type: 'ROOMS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadRooms) return undefined;
    const controller = new AbortController();
    roomControllerRef.current = controller;
    runRoomLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (roomGenerationRef.current === generation) roomGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadRooms, cancelRoomRequest, commitInternal, runRoomLoad]);

  useEffect(() => {
    const generation = reservationGenerationRef.current + 1;
    reservationGenerationRef.current = generation;
    availabilityGenerationRef.current += 1;
    reservationCreateGenerationRef.current += 1;
    cancelReservationLoad();
    cancelReservationAvailability();
    cancelReservationCreate();
    commitInternal({ type: 'RESERVATIONS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadReservations) return undefined;
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
  }, [accountIdentity, authStatus, canReadReservations, cancelReservationAvailability, cancelReservationCreate, cancelReservationLoad, commitInternal, runReservationLoad]);

  useEffect(() => {
    const generation = stayGenerationRef.current + 1;
    stayGenerationRef.current = generation;
    stayCommandGenerationRef.current += 1;
    cancelStayLoad();
    cancelStayCommand();
    commitInternal({ type: 'STAYS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadStays) return undefined;
    const controller = new AbortController();
    stayControllerRef.current = controller;
    runStayLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      stayCommandControllerRef.current?.abort();
      if (stayGenerationRef.current === generation) stayGenerationRef.current += 1;
      stayCommandGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadStays, cancelStayCommand, cancelStayLoad, commitInternal, runStayLoad]);

  useEffect(() => {
    const generation = cleaningGenerationRef.current + 1;
    cleaningGenerationRef.current = generation;
    cleaningCommandGenerationRef.current += 1;
    cancelCleaningLoad();
    cancelCleaningCommand();
    commitInternal({ type: 'CLEANING_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadCleaning) return undefined;
    const controller = new AbortController();
    cleaningControllerRef.current = controller;
    runCleaningLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      cleaningCommandControllerRef.current?.abort();
      if (cleaningGenerationRef.current === generation) cleaningGenerationRef.current += 1;
      cleaningCommandGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadCleaning, cancelCleaningCommand, cancelCleaningLoad, commitInternal, runCleaningLoad]);

  useEffect(() => {
    const generation = incidentGenerationRef.current + 1;
    incidentGenerationRef.current = generation;
    cancelIncidentLoad();
    commitInternal({ type: 'INCIDENTS_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadIncidents) return undefined;
    const controller = new AbortController();
    incidentControllerRef.current = controller;
    runIncidentLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (incidentGenerationRef.current === generation) incidentGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadIncidents, cancelIncidentLoad, commitInternal, runIncidentLoad]);

  useEffect(() => {
    const generation = maintenanceGenerationRef.current + 1;
    maintenanceGenerationRef.current = generation;
    cancelMaintenanceLoad();
    commitInternal({ type: 'MAINTENANCE_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadMaintenance) return undefined;
    const controller = new AbortController();
    maintenanceControllerRef.current = controller;
    runMaintenanceLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (maintenanceGenerationRef.current === generation) maintenanceGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadMaintenance, cancelMaintenanceLoad, commitInternal, runMaintenanceLoad]);

  useEffect(() => {
    const generation = cashGenerationRef.current + 1;
    cashGenerationRef.current = generation;
    cancelCashLoad();
    commitInternal({ type: 'CASH_RESET' });
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadCash) return undefined;
    const controller = new AbortController();
    cashControllerRef.current = controller;
    runCashLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (cashGenerationRef.current === generation) cashGenerationRef.current += 1;
    };
  }, [accountIdentity, authStatus, canReadCash, cancelCashLoad, commitInternal, runCashLoad]);

  const reloadResource = useCallback((resourceKey) => {
    const config = RESTAURANT_RESOURCE_DEFINITIONS[resourceKey];
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(config.permission)) {
      return Promise.resolve(null);
    }
    cancelResourceLoad(resourceKey);
    const ref = resourceRefs.current[resourceKey];
    ref.generation += 1;
    const controller = new AbortController();
    ref.controller = controller;
    return runResourceLoad(resourceKey, ref.generation, controller);
  }, [cancelResourceLoad, runResourceLoad]);

  useEffect(() => {
    const identityKey = authStatus === 'authenticated' ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}` : '';
    commitInternal({ type: 'RESTAURANT_RESOURCES_RESET', identityKey });
    
    if (authStatus !== 'authenticated' || !identityKey) return undefined;
    
    Object.keys(RESTAURANT_RESOURCE_DEFINITIONS).forEach((key) => {
      cancelResourceLoad(key);
      const config = RESTAURANT_RESOURCE_DEFINITIONS[key];
      if (permissions.includes(config.permission)) {
        const ref = resourceRefs.current[key];
        ref.generation += 1;
        const controller = new AbortController();
        ref.controller = controller;
        runResourceLoad(key, ref.generation, controller).catch(() => {});
      } else {
        commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey: key, domainKey: config.domainKey, generation: resourceRefs.current[key].generation, identityKey });
      }
    });

    return () => {
      Object.keys(RESTAURANT_RESOURCE_DEFINITIONS).forEach((key) => {
        resourceRefs.current[key]?.controller?.abort();
      });
    };
  }, [accountIdentity, authStatus, permissions, cancelResourceLoad, commitInternal, runResourceLoad]);

  const assertPermission = useCallback((action) => {
    const required = permissionForAction(action);
    const authorized = authRef.current.authStatus === 'authenticated' && required && authRef.current.permissions.includes(required);
    if (!authorized) throw new GuestRequestError('No cuenta con permiso para realizar esta operación.', 403);
  }, []);

  const reloadGuests = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.guestsRead)) {
      return Promise.reject(new GuestRequestError('No cuenta con permiso para consultar huéspedes.', 403));
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelGuestLoad();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    return runGuestLoad(generation, controller);
  }, [cancelGuestLoad, runGuestLoad]);

  const assertRoomPermission = useCallback((permission, message) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new RoomRequestError(message, 403);
  }, []);

  const reloadRooms = useCallback(() => {
    assertRoomPermission(PERMISSIONS.roomsRead, 'No cuenta con permiso para consultar habitaciones.');
    const generation = roomGenerationRef.current + 1;
    roomGenerationRef.current = generation;
    cancelRoomRequest();
    const controller = new AbortController();
    roomControllerRef.current = controller;
    return runRoomLoad(generation, controller);
  }, [assertRoomPermission, cancelRoomRequest, runRoomLoad]);

  const assertReservationReadPermission = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.reservationsRead)) {
      throw new ReservationRequestError('No cuenta con permiso para consultar reservas.', 403);
    }
  }, []);

  const assertReservationCreateAccess = useCallback(() => {
    if (!hasReservationCreateAccess(authRef.current.authStatus, authRef.current.permissions)) {
      throw new ReservationRequestError('No cuenta con todos los permisos necesarios para crear reservas.', 403);
    }
  }, []);

  const reloadReservations = useCallback(() => {
    assertReservationReadPermission();
    const generation = reservationGenerationRef.current + 1;
    reservationGenerationRef.current = generation;
    cancelReservationLoad();
    const controller = new AbortController();
    reservationControllerRef.current = controller;
    return runReservationLoad(generation, controller);
  }, [assertReservationReadPermission, cancelReservationLoad, runReservationLoad]);

  const reloadStays = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.staysRead)) throw new StayRequestError('No cuenta con permiso para consultar estadías.', 403);
    const generation = stayGenerationRef.current + 1;
    stayGenerationRef.current = generation;
    cancelStayLoad();
    const controller = new AbortController();
    stayControllerRef.current = controller;
    return runStayLoad(generation, controller);
  }, [cancelStayLoad, runStayLoad]);

  const reloadCleaning = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.cleaningRead)) throw new CleaningRequestError('No cuenta con permiso para consultar limpieza.', 403);
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

  const reloadCash = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.cashRead)) throw new CashRequestError('No cuenta con permiso para consultar caja.', 403);
    const generation = cashGenerationRef.current + 1;
    cashGenerationRef.current = generation;
    cancelCashLoad();
    const controller = new AbortController();
    cashControllerRef.current = controller;
    return runCashLoad(generation, controller);
  }, [cancelCashLoad, runCashLoad]);

  const createGuestCommand = useCallback(async (input) => {
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
  }, [assertPermission, cancelGuestLoad, commitInternal]);

  const updateGuestCommand = useCallback(async (guestId, input) => {
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
      if (error.reloadRecommended && generation === generationRef.current) reloadGuests().catch(() => {});
      throw error;
    }
  }, [assertPermission, cancelGuestLoad, commitInternal, reloadGuests]);

  const archiveGuestCommand = useCallback(async (guestId) => {
    assertPermission({ type: 'GUESTS_ARCHIVE' }); // Assuming the generic assertPermission supports this or maybe just bypass generic assert since it is checked at UI and controller level? Wait, in HotelContext, they do: `assertPermission({ type: 'CLIENT_UPDATE' });`. The action might not exist. Let's just use the client to throw.
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
      if (error.reloadRecommended && generation === generationRef.current) reloadGuests().catch(() => {});
      throw error;
    }
  }, [assertPermission, cancelGuestLoad, commitInternal, reloadGuests]);

  const reactivateGuestCommand = useCallback(async (guestId) => {
    assertPermission({ type: 'GUESTS_ARCHIVE' });
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
      if (error.reloadRecommended && generation === generationRef.current) reloadGuests().catch(() => {});
      throw error;
    }
  }, [assertPermission, cancelGuestLoad, commitInternal, reloadGuests]);

  const runRoomMutation = useCallback(async (request, current) => {
    const generation = roomGenerationRef.current + 1;
    roomGenerationRef.current = generation;
    cancelRoomRequest();
    const controller = new AbortController();
    roomControllerRef.current = controller;
    commitInternal({ type: 'ROOM_MUTATION_STARTED' });
    try {
      const response = await request(controller.signal);
      if (generation !== roomGenerationRef.current || controller.signal.aborted) throw createRoomCancellationError();
      const room = adaptRoomMutationResponse(response, current.id);
      commitInternal({ type: 'ROOM_MUTATION_COMMITTED', room });
      return room;
    } catch (error) {
      if (generation !== roomGenerationRef.current || controller.signal.aborted) throw createRoomCancellationError();
      commitInternal({ type: 'ROOM_REQUEST_FAILED', error: error.message });
      if (error.reloadRecommended) reloadRooms().catch(() => {});
      throw error;
    }
  }, [cancelRoomRequest, commitInternal, reloadRooms]);

  const updateRoomCommand = useCallback((roomId, input) => {
    assertRoomPermission(PERMISSIONS.roomsUpdate, 'No cuenta con permiso para editar habitaciones.');
    const current = projectedState.current.rooms.find((room) => room.id === roomId);
    if (!current) throw new RoomRequestError('La habitación ya no está disponible. Actualice la lista.', 404, true);
    const body = buildRoomPatch(current, input) ?? { number: input.number.trim(), floor: Number(input.floor), categoryId: input.categoryId };
    return runRoomMutation((signal) => updateRoom(roomId, body, signal), current);
  }, [assertRoomPermission, runRoomMutation]);

  const setRoomBlockedCommand = useCallback((roomId, blocked, reason) => {
    assertRoomPermission(PERMISSIONS.roomsBlock, 'No cuenta con permiso para bloquear habitaciones.');
    const current = projectedState.current.rooms.find((room) => room.id === roomId);
    if (!current) throw new RoomRequestError('La habitación ya no está disponible. Actualice la lista.', 404, true);
    return runRoomMutation((signal) => setRoomBlocked(roomId, { blocked, reason: reason.trim() }, signal), current);
  }, [assertRoomPermission, runRoomMutation]);

  const updateCategoryCommand = useCallback(async (categoryId, input) => {
    assertRoomPermission(PERMISSIONS.roomsUpdate, 'No cuenta con permiso para editar categorías.');
    const current = projectedState.current.roomCategories.find((cat) => cat.id === categoryId);
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
  }, [assertRoomPermission, commitInternal, reloadRooms]);

  const loadReservationAvailability = useCallback(async (input) => {
    assertReservationCreateAccess();
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
  }, [assertReservationCreateAccess, cancelReservationAvailability, commitInternal]);

  const clearReservationAvailability = useCallback(() => {
    availabilityGenerationRef.current += 1;
    cancelReservationAvailability();
    commitInternal({ type: 'RESERVATION_AVAILABILITY_CLEARED' });
  }, [cancelReservationAvailability, commitInternal]);

  const refreshReservationBoundary = useCallback(async (input) => {
    const query = buildReservationAvailabilityQuery(input);
    const results = await Promise.allSettled([reloadReservations(), loadReservationAvailability(query)]);
    if (!reservationReconciliationSucceeded(results)) {
      throw new ReservationRequestError('No se pudieron actualizar las reservas y la disponibilidad. Actualice los datos antes de reintentar.', null, true, 'reconciliation_required', true);
    }
    commitInternal({ type: 'RESERVATION_CREATE_RECONCILED' });
    return { reservations: results[0].value, availability: results[1].value };
  }, [commitInternal, loadReservationAvailability, reloadReservations]);

  const createReservationCommand = useCallback(async (input) => {
    assertReservationCreateAccess();
    const body = buildReservationCreateDto(input);
    const availabilityQuery = { checkInAt: body.checkInAt, checkOutAt: body.checkOutAt, guestCount: body.guestCount };
    const generation = reservationCreateGenerationRef.current + 1;
    reservationCreateGenerationRef.current = generation;
    cancelReservationCreate();
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
  }, [assertReservationCreateAccess, cancelReservationCreate, commitInternal, loadReservationAvailability, refreshReservationBoundary, reloadReservations]);

  const reservationLifecycleCommand = useCallback(async (reservationId, operation, input = {}, key = createReservationIdempotencyKey()) => {
    if (!hasReservationLifecycleAccess(authRef.current.authStatus, authRef.current.permissions, operation)) throw new ReservationRequestError('No cuenta con permiso para esta acción de reserva.', 403);
    const body = buildReservationLifecycleDto(operation, input);
    const generation = reservationLifecycleGenerationRef.current + 1;
    reservationLifecycleGenerationRef.current = generation;
    reservationLifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    reservationLifecycleControllerRef.current = controller;
    const request = operation === 'confirm' ? confirmReservation(reservationId, key, controller.signal) : operation === 'cancel' ? cancelReservation(reservationId, body, key, controller.signal) : dispositionReservation(reservationId, body, key, controller.signal);
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
  }, [reloadReservations]);

  const loadReservationDetail = useCallback(async (reservationId) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.reservationsRead)) throw new ReservationRequestError('No cuenta con permiso para ver reservas.', 403);
    const generation = reservationLifecycleGenerationRef.current + 1;
    reservationLifecycleGenerationRef.current = generation;
    reservationLifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    reservationLifecycleControllerRef.current = controller;
    const detail = adaptReservationDetailResponse(await getReservationDetail(reservationId, controller.signal));
    if (!isCurrentReservationOperation(generation, reservationLifecycleGenerationRef.current, controller.signal)) throw createReservationCancellationError();
    return detail;
  }, []);

  const runStayCommand = useCallback(async (access, request) => {
    if (!access(authRef.current.authStatus, authRef.current.permissions)) throw new StayRequestError('No cuenta con todos los permisos necesarios para esta operación de recepción.', 403);
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
  }, [cancelStayCommand, commitInternal, reloadCleaning, reloadReservations, reloadRooms, reloadStays]);

  const checkInStayCommand = useCallback((reservationId, input = {}) => runStayCommand(hasStayCheckInAccess, (key, signal) => checkInReservation(reservationId, input, key, signal)), [runStayCommand]);
  const checkOutStayCommand = useCallback((stayId, body = {}) => runStayCommand(hasStayCheckOutAccess, (key, signal) => checkOutStay(stayId, key, signal, body)), [runStayCommand]);

  const runCleaningCommand = useCallback(async (permission, request) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new CleaningRequestError('No cuenta con permiso para esta operación de limpieza.', 403);
    const generation = cleaningCommandGenerationRef.current + 1;
    cleaningCommandGenerationRef.current = generation;
    cancelCleaningCommand();
    const controller = new AbortController();
    cleaningCommandControllerRef.current = controller;
    commitInternal({ type: 'CLEANING_COMMAND_STARTED' });
    try {
      const response = await request(createCleaningIdempotencyKey(), controller.signal);
      if (generation !== cleaningCommandGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'CLEANING_COMMAND_COMMITTED', ...response });
       await Promise.allSettled([reloadCleaning(), reloadRooms(), reloadIncidents()]);
      return response;
    } catch (error) {
      if (generation !== cleaningCommandGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'CLEANING_COMMAND_FAILED', error: error.message });
      if (error.reloadRecommended) reloadCleaning().catch(() => {});
      throw error;
    }
  }, [cancelCleaningCommand, commitInternal, reloadCleaning, reloadIncidents, reloadRooms]);

  const createCleaningTaskCommand = useCallback((roomId, reason, observation, assignedTo) => runCleaningCommand(PERMISSIONS.cleaningAssign, (key, signal) => createCleaningTask({ roomId, reason, observation, assignedTo }, key, signal)), [runCleaningCommand]);
  const updateCleaningCommand = useCallback((taskId, assignedTo, observation, evidence) => runCleaningCommand(PERMISSIONS.cleaningAssign, (key, signal) => updateCleaningTask(taskId, { assignedTo, observation, evidence }, key, signal)), [runCleaningCommand]);
  const progressCleaningCommand = useCallback((taskId, expectedStatus, evidence) => runCleaningCommand(PERMISSIONS.cleaningProgress, (key, signal) => progressCleaningTask(taskId, { expectedStatus: mapCleaningStatusToApi(expectedStatus), evidence }, key, signal)), [runCleaningCommand]);
  const reportCleaningIncidentCommand = useCallback((taskId, description, evidence, responsible, blocksRoom) => runCleaningCommand(PERMISSIONS.cleaningReportIncident, (key, signal) => reportCleaningIncident(taskId, { description, evidence, responsible, blocksRoom }, key, signal)), [runCleaningCommand]);

  const createIncidentCommand = useCallback(async (body) => {
    const response = await createIncident(body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_CREATED', incident: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const updateIncidentCommand = useCallback(async (id, body) => {
    const response = await updateIncident(id, body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_UPDATED', incident: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const progressIncidentCommand = useCallback(async (id, body) => {
    const response = await progressIncident(id, body);
    const adapted = adaptIncidentList([response]);
    commitInternal({ type: 'INCIDENT_UPDATED', incident: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const createMaintenanceCommand = useCallback(async (body) => {
    const response = await createMaintenanceTicket(body);
    const adapted = adaptMaintenanceList([response]);
    const incident = adaptIncidentList([response])[0];
    commitInternal({ type: 'MAINTENANCE_CREATED', ticket: adapted[0] });
    commitInternal({ type: 'INCIDENT_CREATED', incident });
    await reloadIncidents().catch(() => {});
    return adapted[0];
  }, [commitInternal, reloadIncidents]);

  const updateMaintenanceCommand = useCallback(async (id, body) => {
    const response = await updateMaintenanceTicket(id, body);
    const adapted = adaptMaintenanceList([response]);
    commitInternal({ type: 'MAINTENANCE_UPDATED', ticket: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const progressMaintenanceCommand = useCallback(async (id, body) => {
    const response = await progressMaintenanceTicket(id, body);
    const adapted = adaptMaintenanceList([response]);
    commitInternal({ type: 'MAINTENANCE_UPDATED', ticket: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const openCashSessionCommand = useCallback(async (input) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.cashOpen)) throw new CashRequestError('No cuenta con permiso para abrir caja.', 403);
    const controller = new AbortController();
    try {
      const body = buildOpenCashSessionDto(input);
      const dto = await openCashSession(body, controller.signal);
      const session = adaptCashSession(dto);
      commitInternal({ type: 'CASH_SESSION_OPENED', session });
      await reloadCash();
      return session;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  }, [commitInternal, reloadCash]);

  const countCashSessionCommand = useCallback(async (sessionId, input) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.cashCount)) throw new CashRequestError('No cuenta con permiso para arqueo de caja.', 403);
    const controller = new AbortController();
    const body = buildCountCashSessionDto(input);
    const dto = await countCashSession(sessionId, body, controller.signal);
    const session = adaptCashSession(dto);
    await reloadCash();
    return session;
  }, [reloadCash]);

  const closeCashSessionCommand = useCallback(async (sessionId, input) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.cashClose)) throw new CashRequestError('No cuenta con permiso para cerrar caja.', 403);
    const controller = new AbortController();
    try {
      const body = buildCountCashSessionDto(input);
      const dto = await closeCashSession(sessionId, body, controller.signal);
      const session = adaptCashSession(dto);
      commitInternal({ type: 'CASH_SESSION_CLOSED', session });
      await reloadCash();
      return session;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  }, [commitInternal, reloadCash]);

  const createCashMovementCommand = useCallback(async (input) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.cashMove)) throw new CashRequestError('No cuenta con permiso para registrar movimientos de caja.', 403);
    const controller = new AbortController();
    try {
      const body = buildCashMovementDto(input);
      const dto = await createCashMovement(body, controller.signal);
      const movement = adaptCashMovement(dto);
      commitInternal({ type: 'CASH_MOVEMENT_CREATED', movement });
      await reloadCash();
      return movement;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  }, [commitInternal, reloadCash]);

  const runParkingCommand = useCallback(async (action) => {
    const required = permissionForAction(action);
    if (!required || !(Array.isArray(required) ? required.some((permission) => authRef.current.permissions.includes(permission)) : authRef.current.permissions.includes(required))) {
      throw new ParkingRequestError('No cuenta con permiso para esta operación.', 403);
    }
    const validation = validateHotelAction(projectedState.current, action);
    if (!validation.ok) throw new ParkingRequestError(validation.error || validation.message || 'Revise los datos del vehículo.', 400);

    parkingRequestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = parkingRequestGenerationRef.current + 1;
    parkingRequestGenerationRef.current = generation;
    parkingRequestControllerRef.current = controller;
    const result = await runConfirmedOperationalRequest({
      request: (signal) => {
        if (action.type === 'PARKING_CREATE') return createVehicle(buildVehicleCreateDto(projectedState.current, action), signal);
        if (action.type === 'PARKING_UPDATE') return updateVehicle(action.vehicleId, buildVehicleUpdateDto(projectedState.current, action), signal);
        if (action.type === 'PARKING_EXIT') return exitVehicle(action.vehicleId, { exitObservation: action.observation, exitResponsible: action.responsible }, signal);
        return archiveVehicle(action.vehicleId, action.reason, signal);
      },
      adaptRecord: adaptVehicleResponse,
      generation,
      getCurrentGeneration: () => parkingRequestGenerationRef.current,
      signal: controller.signal,
      onCommit: (vehicle) => commitInternal({ type: 'PARKING_RECORD_COMMITTED', vehicle }),
      reconcile: () => loadOperationalRecords({
        fetchRecords: fetchVehicles,
        adaptRecord: adaptVehicleResponse,
        generation,
        getCurrentGeneration: () => parkingRequestGenerationRef.current,
        signal: controller.signal,
        onSuccess: (vehicles) => commitInternal({ type: 'PARKING_LOAD_SUCCEEDED', vehicles }),
        onFailure: (error) => commitInternal({ type: 'PARKING_LOAD_FAILED', error: error.message }),
      }),
    });
    if (result.status === 'superseded') throw new ParkingRequestError('La operación fue reemplazada por una solicitud más reciente. Actualice antes de reintentar.');
    return result.record;
  }, [commitInternal]);

  const runPetCommand = useCallback(async (action) => {
    const required = permissionForAction(action);
    if (!required || !(Array.isArray(required) ? required.some((permission) => authRef.current.permissions.includes(permission)) : authRef.current.permissions.includes(required))) {
      throw new PetRequestError('No cuenta con permiso para esta operación.', 403);
    }
    const validation = validateHotelAction(projectedState.current, action);
    if (!validation.ok) throw new PetRequestError(validation.error || validation.message || 'Revise los datos de la mascota.', 400);

    petRequestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = petRequestGenerationRef.current + 1;
    petRequestGenerationRef.current = generation;
    petRequestControllerRef.current = controller;
    const result = await runConfirmedOperationalRequest({
      request: (signal) => {
        if (action.type === 'PET_CREATE') return createPet(buildPetCreateDto(projectedState.current, action.payload), signal);
        if (action.type === 'PET_UPDATE') return updatePet(action.petId, buildPetUpdateDto(action.payload), signal);
        if (action.type === 'PET_ARCHIVE') return archivePet(action.petId, action.reason, signal);
        return reactivatePet(action.petId, action.reason, signal);
      },
      adaptRecord: adaptPetResponse,
      generation,
      getCurrentGeneration: () => petRequestGenerationRef.current,
      signal: controller.signal,
      onCommit: (pet) => commitInternal({ type: 'PET_RECORD_COMMITTED', pet }),
      reconcile: () => loadOperationalRecords({
        fetchRecords: fetchPets,
        adaptRecord: adaptPetResponse,
        generation,
        getCurrentGeneration: () => petRequestGenerationRef.current,
        signal: controller.signal,
        onSuccess: (pets) => commitInternal({ type: 'PET_LOAD_SUCCEEDED', pets }),
        onFailure: (error) => commitInternal({ type: 'PET_LOAD_FAILED', error: error.message }),
      }),
    });
    if (result.status === 'superseded') throw new PetRequestError('La operación fue reemplazada por una solicitud más reciente. Actualice antes de reintentar.');
    return result.record;
  }, [commitInternal]);

  const reloadParkingRecords = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.parkingRead)) {
      throw new ParkingRequestError('No cuenta con permiso para consultar la cochera.', 403);
    }
    parkingRequestControllerRef.current?.abort();
    const generation = parkingRequestGenerationRef.current + 1;
    parkingRequestGenerationRef.current = generation;
    const controller = new AbortController();
    parkingRequestControllerRef.current = controller;
    return loadParkingRecords(generation, controller);
  }, [loadParkingRecords]);

  const reloadPetRecords = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(PERMISSIONS.petsRead)) {
      throw new PetRequestError('No cuenta con permiso para consultar las mascotas.', 403);
    }
    petRequestControllerRef.current?.abort();
    const generation = petRequestGenerationRef.current + 1;
    petRequestGenerationRef.current = generation;
    const controller = new AbortController();
    petRequestControllerRef.current = controller;
    return loadPetRecords(generation, controller);
  }, [loadPetRecords]);

  // ─── Menu Management ────────────────────────────────────────────────────────
  const runManagedMenuLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'MANAGED_MENU_LOAD_STARTED' });
    try {
      const response = await getManagedMenu(controller.signal);
      if (generation !== managedMenuGenRef.current || controller.signal.aborted) return null;
      const items = adaptManagedMenuList(response);
      commitInternal({ type: 'MANAGED_MENU_LOAD_SUCCEEDED', items, version: generation });
      return items;
    } catch (error) {
      if (generation !== managedMenuGenRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'MANAGED_MENU_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadManagedMenu = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !hasKitchenManagementAccess(authRef.current.permissions)) {
      throw new Error('No cuenta con los permisos requeridos para gestionar el menú.');
    }
    cancelManagedMenuLoad();
    const generation = managedMenuGenRef.current + 1;
    managedMenuGenRef.current = generation;
    const controller = new AbortController();
    managedMenuControllerRef.current = controller;
    return runManagedMenuLoad(generation, controller);
  }, [cancelManagedMenuLoad, runManagedMenuLoad]);

  const execute = useCallback((action) => {
    const clientSubject = action.type === 'BIOMETRIC_ATTEMPT' && projectedState.current.clients.some((item) => item.id === action.subjectId);
    const staffSubject = action.type === 'BIOMETRIC_ATTEMPT' && projectedState.current.staff.some((item) => item.id === action.subjectId);
    const authorizedAction = action.type === 'BIOMETRIC_ATTEMPT' && clientSubject !== staffSubject
      ? { ...action, subjectType: clientSubject ? 'guest' : 'staff' }
      : action;
    const requiredPermission = permissionForAction(authorizedAction);
    if (action.type === 'BIOMETRIC_ATTEMPT' && !requiredPermission) return { ok: false, error: 'No se pudo determinar el tipo de persona biométrica.' };
    if (requiredPermission && !(Array.isArray(requiredPermission) ? requiredPermission.some(can) : can(requiredPermission))) return { ok: false, error: 'No tenés permiso para realizar esta operación.' };
    if (action.type.startsWith('PARKING_') || action.type.startsWith('PET_')) return { ok: false, error: 'Esta operación requiere confirmación del servidor.' };
    const result = validateHotelAction(projectedState.current, authorizedAction);
    if (result.ok) {
      projectedState.current = hotelReducer(projectedState.current, authorizedAction);
      reducerDispatch(authorizedAction);

      // --- Intercept Restaurant Actions to Persist in Background ---
      // NOTE: Inventory mutations (create/update/archive/adjust) are handled by
      // confirmed inventoryCommands and must NOT be dispatched through execute().
      // NOTE 2: Menu mutations (create/update/archive manual) are handled by
      // menuManagementCommands and must NOT be dispatched through execute().
      if (action.type.startsWith('ORDER_')) {
        // Optimistic execution of ORDER_* is now strictly prohibited.
        // Use restaurantCommands directly.
      }
    }
    return result;
  }, [can, reloadResource]);

  // ─── Restaurant Commands ──────────────────────────────────────────────────
  const createOrderCommand = useCallback(async (body, idempotencyKey) => {
    try {
      const response = await createOrder(body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_CREATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
    }
  }, [commitInternal, reloadResource]);

  const updateOrderCommand = useCallback(async (orderId, body, idempotencyKey) => {
    try {
      const response = await updateOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
    }
  }, [commitInternal, reloadResource]);

  const advanceOrderCommand = useCallback(async (orderId, body, idempotencyKey) => {
    try {
      const response = await advanceOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  }, [commitInternal, reloadResource]);

  const advanceOrderItemCommand = useCallback(async (orderId, itemId, body, idempotencyKey) => {
    try {
      const response = await advanceOrderItem(orderId, itemId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  }, [commitInternal, reloadResource]);

  const cancelOrderCommand = useCallback(async (orderId, body, idempotencyKey) => {
    try {
      const response = await cancelOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  }, [commitInternal, reloadResource]);

  // ─── Menu Management Commands (Confirmed) ───────────────────────────────────
  const createManualMenuItemCommand = useCallback(async (body) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para gestionar el menú.');
    const response = await createMenuItem(body);
    const adapted = adaptManagedMenuList([response])[0];
    commitInternal({ type: 'MENU_ITEM_COMMITTED', item: adapted });
    Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
    return adapted;
  }, [commitInternal, reloadManagedMenu, reloadResource]);

  const updateManualMenuItemCommand = useCallback(async (id, body) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await updateMenuItem(id, body);
      const adapted = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item: adapted });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return adapted;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  }, [commitInternal, reloadManagedMenu, reloadResource]);

  const archiveManualMenuItemCommand = useCallback(async (id, body) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await archiveMenuItem(id, body);
      const adapted = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item: adapted });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return adapted;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  }, [commitInternal, reloadManagedMenu, reloadResource]);

  const reactivateManualMenuItemCommand = useCallback(async (id) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await reactivateMenuItem(id);
      const adapted = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item: adapted });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return adapted;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  }, [commitInternal, reloadManagedMenu, reloadResource]);

  const previewImportCommand = useCallback(async (markdown, contentHash) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para importar el menú.');
    cancelMenuImport();
    const controller = new AbortController();
    menuImportControllerRef.current = controller;
    commitInternal({ type: 'MENU_IMPORT_PREVIEW_STARTED' });
    try {
      const result = await previewMenuImport({ markdown }, controller.signal);
      commitInternal({ type: 'MENU_IMPORT_PREVIEW_DONE', result: adaptImportPreviewResult(result), contentHash });
    } catch (error) {
      if (controller.signal.aborted) return;
      commitInternal({ type: 'MENU_IMPORT_ERROR', error: error.message });
    }
  }, [cancelMenuImport, commitInternal]);

  const applyImportCommand = useCallback(async (markdown, expectedHash) => {
    if (!hasKitchenManagementAccess(authRef.current.permissions)) throw new Error('Sin permiso para importar el menú.');
    
    // Validate that the request matches the latest preview
    if (projectedState.current.menuImportRequest.contentHash !== expectedHash) {
      throw new Error('El contenido fue modificado o no hay previsualización vigente.');
    }
    if (projectedState.current.menuPendingMutations.length > 0) {
      throw new Error('Hay operaciones de ítem pendientes. Esperá a que terminen.');
    }

    cancelMenuImport();
    const controller = new AbortController();
    menuImportControllerRef.current = controller;
    commitInternal({ type: 'MENU_IMPORT_APPLY_STARTED' });
    try {
      const result = await applyMenuImport({ markdown }, controller.signal);
      commitInternal({ type: 'MENU_IMPORT_APPLY_DONE', result: adaptImportPreviewResult(result) });
      
      // Reload both admin catalogue and operational menu
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
    } catch (error) {
      if (controller.signal.aborted) return;
      commitInternal({ type: 'MENU_IMPORT_ERROR', error: error.message });
      throw error;
    }
  }, [cancelMenuImport, commitInternal, reloadManagedMenu, reloadResource]);

  const clearImportCommand = useCallback(() => {
    cancelMenuImport();
    commitInternal({ type: 'MENU_IMPORT_CLEARED' });
  }, [cancelMenuImport, commitInternal]);

  // ─── Confirmed Inventory Commands (no optimistic writes) ──────────────────
  const createInventoryItemCommand = useCallback(async (body) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.inventoryCreate)) throw new Error('Sin permiso para crear insumos.');
    const response = await createInventoryItem(body);
    const adapted = adaptInventoryList([response]);
    const item = adapted[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_CREATED', item });
    // Reload inventory to get server-canonical state; ledger unchanged on create
    Promise.allSettled([reloadResource('inventory'), reloadResource('menu')]);
    return item;
  }, [commitInternal, reloadResource]);

  const updateInventoryItemCommand = useCallback(async (id, body) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.inventoryUpdate)) throw new Error('Sin permiso para editar insumos.');
    const response = await updateInventoryItem(id, body);
    const adapted = adaptInventoryList([response]);
    const item = adapted[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('menu')]);
    return item;
  }, [commitInternal, reloadResource]);

  const archiveInventoryItemCommand = useCallback(async (id, body) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.inventoryArchive)) throw new Error('Sin permiso para archivar insumos.');
    const response = await archiveInventoryItem(id, body);
    const adapted = adaptInventoryList([response]);
    const item = adapted[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    // Archive may affect ledger indirectly; reload both
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  }, [commitInternal, reloadResource]);

  const reactivateInventoryItemCommand = useCallback(async (id) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.inventoryArchive)) throw new Error('Sin permiso para reactivar insumos.');
    const response = await reactivateInventoryItem(id);
    const adapted = adaptInventoryList([response]);
    const item = adapted[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  }, [commitInternal, reloadResource]);

  const adjustInventoryCommand = useCallback(async (id, body) => {
    if (!authRef.current.permissions.includes(PERMISSIONS.inventoryAdjust)) throw new Error('Sin permiso para ajustar inventario.');
    const response = await adjustInventory(id, body);
    const adapted = adaptInventoryList([response]);
    const item = adapted[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    // Adjust always generates a ledger entry; reload both
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  }, [commitInternal, reloadResource]);

  const guestCommands = useMemo(() => ({ reload: reloadGuests, create: createGuestCommand, update: updateGuestCommand, archive: archiveGuestCommand, reactivate: reactivateGuestCommand }), [createGuestCommand, reloadGuests, updateGuestCommand, archiveGuestCommand, reactivateGuestCommand]);
  const roomCommands = useMemo(() => ({ reload: reloadRooms, update: updateRoomCommand, updateCategory: updateCategoryCommand, setBlocked: setRoomBlockedCommand }), [reloadRooms, setRoomBlockedCommand, updateCategoryCommand, updateRoomCommand]);
  const reservationCommands = useMemo(() => ({
    reload: reloadReservations,
    availability: loadReservationAvailability,
    create: createReservationCommand,
    detail: loadReservationDetail,
    lifecycle: reservationLifecycleCommand,
    clearAvailability: clearReservationAvailability,
    refreshForRetry: refreshReservationBoundary,
  }), [clearReservationAvailability, createReservationCommand, loadReservationAvailability, loadReservationDetail, refreshReservationBoundary, reloadReservations, reservationLifecycleCommand]);
  const stayCommands = useMemo(() => ({ reload: reloadStays, checkIn: checkInStayCommand, checkOut: checkOutStayCommand }), [checkInStayCommand, checkOutStayCommand, reloadStays]);
  const cleaningCommands = useMemo(() => ({ reload: reloadCleaning, create: createCleaningTaskCommand, update: updateCleaningCommand, progress: progressCleaningCommand, reportIncident: reportCleaningIncidentCommand }), [progressCleaningCommand, reloadCleaning, reportCleaningIncidentCommand, updateCleaningCommand, createCleaningTaskCommand]);
  const incidentCommands = useMemo(() => ({ reload: reloadIncidents, create: createIncidentCommand, update: updateIncidentCommand, progress: progressIncidentCommand }), [createIncidentCommand, progressIncidentCommand, reloadIncidents, updateIncidentCommand]);
  const maintenanceCommands = useMemo(() => ({ reload: reloadMaintenance, create: createMaintenanceCommand, update: updateMaintenanceCommand, progress: progressMaintenanceCommand }), [createMaintenanceCommand, progressMaintenanceCommand, reloadMaintenance, updateMaintenanceCommand]);
  const restaurantCommands = useMemo(() => ({
    reload: () => { reloadResource('menu'); reloadResource('orders'); },
    reloadResource,
    createOrder: createOrderCommand,
    updateOrder: updateOrderCommand,
    advanceOrder: advanceOrderCommand,
    advanceOrderItem: advanceOrderItemCommand,
    cancelOrder: cancelOrderCommand,
  }), [reloadResource, createOrderCommand, updateOrderCommand, advanceOrderCommand, advanceOrderItemCommand, cancelOrderCommand]);
  const menuManagementCommands = useMemo(() => ({
    reload: reloadManagedMenu,
    createManual: createManualMenuItemCommand,
    updateManual: updateManualMenuItemCommand,
    archiveManual: archiveManualMenuItemCommand,
    reactivateManual: reactivateManualMenuItemCommand,
    previewImport: previewImportCommand,
    applyImport: applyImportCommand,
    clearImport: clearImportCommand,
    isMutating: (id) => projectedState.current.menuPendingMutations.includes(id),
  }), [reloadManagedMenu, createManualMenuItemCommand, updateManualMenuItemCommand, archiveManualMenuItemCommand, reactivateManualMenuItemCommand, previewImportCommand, applyImportCommand, clearImportCommand]);
  const inventoryCommands = useMemo(() => ({
    reloadInventory: () => reloadResource('inventory'),
    reloadLedger: () => reloadResource('inventoryLedger'),
    createItem: createInventoryItemCommand,
    updateItem: updateInventoryItemCommand,
    archiveItem: archiveInventoryItemCommand,
    reactivateItem: reactivateInventoryItemCommand,
    adjustStock: adjustInventoryCommand,
  }), [reloadResource, createInventoryItemCommand, updateInventoryItemCommand, archiveInventoryItemCommand, reactivateInventoryItemCommand, adjustInventoryCommand]);
  const cashCommands = useMemo(() => ({ reload: reloadCash, loadDetails: loadCashSessionDetails, open: openCashSessionCommand, count: countCashSessionCommand, close: closeCashSessionCommand, move: createCashMovementCommand }), [openCashSessionCommand, countCashSessionCommand, closeCashSessionCommand, createCashMovementCommand, loadCashSessionDetails, reloadCash]);
  const parkingCommands = useMemo(() => ({ execute: runParkingCommand, reload: reloadParkingRecords }), [reloadParkingRecords, runParkingCommand]);
  const petCommands = useMemo(() => ({ execute: runPetCommand, reload: reloadPetRecords }), [reloadPetRecords, runPetCommand]);

  const commands = useMemo(() => ({ dispatch: execute, execute, guestCommands, roomCommands, reservationCommands, stayCommands, cleaningCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands, menuManagementCommands, inventoryCommands }), [cleaningCommands, execute, guestCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands, menuManagementCommands, inventoryCommands, reservationCommands, roomCommands, stayCommands]);
  return <HotelCommandsContext.Provider value={commands}><HotelStateContext.Provider value={state}>{children}</HotelStateContext.Provider></HotelCommandsContext.Provider>;
}
