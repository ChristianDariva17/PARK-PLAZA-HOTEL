import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth, usePermissions } from '../auth/authContext.js';
import { PERMISSIONS, permissionForAction } from '../auth/permissions.js';
import { getInitialHotelState } from '../domain/hotelModel.js';

// Guests
import { adaptGuestResponse, buildGuestCreateDto, buildGuestPatchDto } from '../guests/guestModel.js';
import { createGuest, createGuestCancellationError, getGuests, GuestRequestError, updateGuest } from '../guests/guestsClient.js';

// Rooms
import { adaptRoomInventoryResponse, adaptRoomMutationResponse, buildRoomPatch } from '../rooms/roomModel.js';
import { createRoomCancellationError, getRooms, RoomRequestError, setRoomBlocked, updateRoom } from '../rooms/roomsClient.js';

// Reservations
import { adaptReservationAvailabilityResponse, adaptReservationCreateResponse, adaptReservationListResponse, buildReservationAvailabilityQuery, buildReservationCreateDto } from '../reservations/reservationModel.js';
import { createReservation, createReservationCancellationError, getReservationAvailability, getReservations, ReservationRequestError } from '../reservations/reservationsClient.js';
import { hasReservationCreateAccess, isCurrentReservationOperation, reservationReconciliationSucceeded } from '../reservations/reservationRequestPolicy.js';

// Stays
import { adaptPersistentStayList, adaptStayCommandResponse, createStayIdempotencyKey } from '../stays/stayModel.js';
import { checkInReservation, checkOutStay, createStayCancellationError, getPersistentStays, StayRequestError } from '../stays/staysClient.js';
import { hasStayCheckInAccess, hasStayCheckOutAccess, isCurrentStayOperation, stayReconciliationSucceeded } from '../stays/stayRequestPolicy.js';

// Cleaning
import { adaptPersistentCleaningList, mapCleaningStatusToApi } from '../cleaning/cleaningModel.js';
import { createCleaningIdempotencyKey, getCleaningTasks, progressCleaningTask, reportCleaningIncident, updateCleaningTask, CleaningRequestError } from '../cleaning/cleaningClient.js';

// Incidents
import { adaptIncidentList } from '../incidents/incidentsModel.js';
import { getIncidents, createIncident, updateIncident, progressIncident, IncidentRequestError } from '../incidents/incidentsClient.js';

// Maintenance
import { adaptMaintenanceList } from '../maintenance/maintenanceModel.js';
import { getMaintenanceTickets, createMaintenanceTicket, updateMaintenanceTicket, progressMaintenanceTicket, MaintenanceRequestError } from '../maintenance/maintenanceClient.js';

// Cash
import { adaptCashSession, adaptCashSessionsList, adaptCashMovement, adaptCashMovementsList, buildOpenCashSessionDto, buildCountCashSessionDto, buildCashMovementDto } from '../cash/cashModel.js';
import { getActiveCashSession, getCashSessions, getCashMovements, openCashSession, countCashSession, closeCashSession, createCashMovement, CashRequestError } from '../cash/cashClient.js';

// Restaurant
import { adaptMenuList, adaptInventoryList, adaptLedgerList, adaptOrdersList } from '../restaurant/restaurantModel.js';
import { getMenu, getInventory, getInventoryLedger, getOrders, createOrder, updateOrder, advanceOrder, cancelOrder, createMenuItem, updateMenuItem, archiveMenuItem, createInventoryItem, updateInventoryItem, adjustInventory } from '../restaurant/restaurantClient.js';

// Pets
import { fetchPets, createPet, updatePet, archivePet, reactivatePet, PetRequestError } from '../pets/petsClient.js';
import { adaptPetResponse, buildPetCreateDto, buildPetUpdateDto } from '../pets/petsModel.js';

// Parking
import { fetchVehicles, createVehicle, updateVehicle, exitVehicle, archiveVehicle, ParkingRequestError } from '../parking/parkingClient.js';
import { adaptVehicleResponse, buildVehicleCreateDto, buildVehicleUpdateDto } from '../parking/parkingModel.js';

import { HotelStateContext } from './hotelContext.js';
import { hotelReducer, validateHotelAction } from './hotelReducer.js';
import { loadOperationalRecords, runConfirmedOperationalRequest } from './operationalRequestPolicy.js';

export function HotelProvider({ children }) {
  const { status: authStatus, account, permissions = [] } = useAuth();
  const { can } = usePermissions();
  const [state, reducerDispatch] = useReducer(hotelReducer, undefined, getInitialHotelState);
  const projectedState = useRef(state);
  useLayoutEffect(() => {
    projectedState.current = state;
  }, [state]);

  const authRef = useRef({ authStatus, permissions });
  useLayoutEffect(() => {
    authRef.current = { authStatus, permissions };
  }, [authStatus, permissions]);

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

  const restaurantGenRef = useRef(0);
  const restaurantControllerRef = useRef(null);
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

  const cancelRestaurantLoad = useCallback(() => {
    restaurantControllerRef.current?.abort();
    restaurantControllerRef.current = null;
    if (projectedState.current.restaurantRequest?.status === 'loading') commitInternal({ type: 'RESTAURANT_LOAD_CANCELLED' });
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

      let movements = [];
      if (active) {
        movements = await getCashMovements(active.id, controller.signal);
        if (generation !== cashGenerationRef.current || controller.signal.aborted) return null;
      }

      const openSession = adaptCashSession(active);
      const cashSessions = adaptCashSessionsList(history);
      const cashMovements = adaptCashMovementsList(movements);

      commitInternal({ type: 'CASH_LOAD_SUCCEEDED', openSession, cashSessions, cashMovements });
      return { openSession, cashSessions, cashMovements };
    } catch (error) {
      if (generation !== cashGenerationRef.current || controller.signal.aborted) return null;
      if (error.status === 401) return null;
      commitInternal({ type: 'CASH_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const runRestaurantLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'RESTAURANT_LOAD_STARTED' });
    try {
      const [menuRaw, inventoryRaw, ledgerRaw, ordersRaw] = await Promise.all([
        getMenu(controller.signal),
        getInventory(controller.signal),
        getInventoryLedger(controller.signal),
        getOrders(controller.signal),
      ]);
      if (generation !== restaurantGenRef.current || controller.signal.aborted) return null;
      commitInternal({
        type: 'RESTAURANT_LOAD_SUCCEEDED',
        recipes: adaptMenuList(menuRaw),
        inventory: adaptInventoryList(inventoryRaw),
        inventoryLedger: adaptLedgerList(ledgerRaw),
        orders: adaptOrdersList(ordersRaw),
      });
    } catch (error) {
      if (generation !== restaurantGenRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'RESTAURANT_LOAD_FAILED', error: error.message });
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

  const reloadRestaurant = useCallback(() => {
    if (authStatus !== 'authenticated' || !accountIdentity || !canReadOrders) return undefined;
    const generation = restaurantGenRef.current + 1;
    restaurantGenRef.current = generation;
    cancelRestaurantLoad();
    const controller = new AbortController();
    restaurantControllerRef.current = controller;
    return runRestaurantLoad(generation, controller);
  }, [accountIdentity, authStatus, canReadOrders, cancelRestaurantLoad, runRestaurantLoad]);

  useEffect(() => { reloadRestaurant(); }, [accountIdentity, reloadRestaurant]);

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
      await Promise.allSettled([reloadReservations(), reloadStays(), reloadRooms()]);
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      return response;
    } catch (error) {
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      if (error.reloadRecommended || error.ambiguous) {
        commitInternal({ type: 'STAY_COMMAND_RECONCILING', error: error.message });
        const results = await Promise.allSettled([reloadReservations(), reloadStays(), reloadRooms()]);
        if (!stayReconciliationSucceeded(results)) {
          commitInternal({ type: 'STAY_COMMAND_FAILED', error: 'No se pudieron recargar las reservas, estadías y habitaciones. Actualice antes de reintentar.', retryBlocked: true });
          throw new StayRequestError('No se pudo reconciliar la recepción.', null, true, 'reconciliation_required', true);
        }
      }
      if (!isCurrentStayOperation(generation, stayCommandGenerationRef.current, controller.signal)) throw createStayCancellationError();
      commitInternal({ type: 'STAY_COMMAND_FAILED', error: error.message, retryBlocked: false });
      throw error;
    }
  }, [cancelStayCommand, commitInternal, reloadReservations, reloadRooms, reloadStays]);

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
      await Promise.allSettled([reloadCleaning(), reloadRooms()]);
      return response;
    } catch (error) {
      if (generation !== cleaningCommandGenerationRef.current || controller.signal.aborted) return null;
      commitInternal({ type: 'CLEANING_COMMAND_FAILED', error: error.message });
      if (error.reloadRecommended) reloadCleaning().catch(() => {});
      throw error;
    }
  }, [cancelCleaningCommand, commitInternal, reloadCleaning, reloadRooms]);

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
    commitInternal({ type: 'MAINTENANCE_CREATED', ticket: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

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
    commitInternal({ type: 'CASH_SESSION_COUNTED', session });
    return session;
  }, [commitInternal]);

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
      if (action.type === 'INVENTORY_ITEM_CREATE') {
        createInventoryItem(action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'INVENTORY_ITEM_UPDATE') {
        updateInventoryItem(action.itemId, action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'INVENTORY_ITEM_ARCHIVE') {
        archiveInventoryItem(action.itemId, { reason: action.reason || 'Archivado' }).then(() => reloadRestaurant());
      } else if (action.type === 'INVENTORY_ADJUST') {
        adjustInventory(action.itemId, {
          quantity: Number(action.quantity),
          note: action.reason || 'Ajuste manual',
          type: action.quantity > 0 ? 'Entrada' : 'Ajuste'
        }).then(() => reloadRestaurant());
      } else if (action.type === 'RECIPE_CREATE') {
        createMenuItem(action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'RECIPE_UPDATE') {
        updateMenuItem(action.recipeId, action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'RECIPE_ARCHIVE') {
        archiveMenuItem(action.recipeId, { reason: action.reason }).then(() => reloadRestaurant());
      } else if (action.type === 'ORDER_CREATE') {
        createOrder(action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'ORDER_UPDATE') {
        updateOrder(action.orderId, action.payload).then(() => reloadRestaurant());
      } else if (action.type === 'ORDER_ADVANCE') {
        advanceOrder(action.orderId, { expectedStatus: action.expectedStatus }).then(() => reloadRestaurant());
      } else if (action.type === 'ORDER_CANCEL') {
        cancelOrder(action.orderId, { reason: action.reason || 'Cancelacion' }).then(() => reloadRestaurant());
      }
    }
    return result;
  }, [can, reloadRestaurant]);

  // ─── Restaurant Commands ──────────────────────────────────────────────────
  const createOrderCommand = useCallback(async (body) => {
    const response = await createOrder(body);
    const adapted = adaptOrdersList([response]);
    commitInternal({ type: 'RESTAURANT_ORDER_CREATED', order: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const updateOrderCommand = useCallback(async (orderId, body) => {
    const response = await updateOrder(orderId, body);
    const adapted = adaptOrdersList([response]);
    commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const advanceOrderCommand = useCallback(async (orderId, body) => {
    const response = await advanceOrder(orderId, body);
    const adapted = adaptOrdersList([response]);
    commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const cancelOrderCommand = useCallback(async (orderId, body) => {
    const response = await cancelOrder(orderId, body);
    const adapted = adaptOrdersList([response]);
    commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const createMenuItemCommand = useCallback(async (body) => {
    const response = await createMenuItem(body);
    const adapted = adaptMenuList([response]);
    commitInternal({ type: 'RESTAURANT_MENU_ITEM_CREATED', item: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const updateMenuItemCommand = useCallback(async (id, body) => {
    const response = await updateMenuItem(id, body);
    const adapted = adaptMenuList([response]);
    commitInternal({ type: 'RESTAURANT_MENU_ITEM_UPDATED', item: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const archiveMenuItemCommand = useCallback(async (id, body) => {
    const response = await archiveMenuItem(id, body);
    const adapted = adaptMenuList([response]);
    commitInternal({ type: 'RESTAURANT_MENU_ITEM_UPDATED', item: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const createInventoryItemCommand = useCallback(async (body) => {
    const response = await createInventoryItem(body);
    const adapted = adaptInventoryList([response]);
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_CREATED', item: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const updateInventoryItemCommand = useCallback(async (id, body) => {
    const response = await updateInventoryItem(id, body);
    const adapted = adaptInventoryList([response]);
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item: adapted[0] });
    return adapted[0];
  }, [commitInternal]);

  const adjustInventoryCommand = useCallback(async (id, body) => {
    const response = await adjustInventory(id, body);
    const adapted = adaptInventoryList([response]);
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item: adapted[0] });
    reloadRestaurant();
    return adapted[0];
  }, [commitInternal, reloadRestaurant]);

  const guestCommands = useMemo(() => ({ reload: reloadGuests, create: createGuestCommand, update: updateGuestCommand }), [createGuestCommand, reloadGuests, updateGuestCommand]);
  const roomCommands = useMemo(() => ({ reload: reloadRooms, update: updateRoomCommand, setBlocked: setRoomBlockedCommand }), [reloadRooms, setRoomBlockedCommand, updateRoomCommand]);
  const reservationCommands = useMemo(() => ({
    reload: reloadReservations,
    availability: loadReservationAvailability,
    create: createReservationCommand,
    clearAvailability: clearReservationAvailability,
    refreshForRetry: refreshReservationBoundary,
  }), [clearReservationAvailability, createReservationCommand, loadReservationAvailability, refreshReservationBoundary, reloadReservations]);
  const stayCommands = useMemo(() => ({ reload: reloadStays, checkIn: checkInStayCommand, checkOut: checkOutStayCommand }), [checkInStayCommand, checkOutStayCommand, reloadStays]);
  const cleaningCommands = useMemo(() => ({ reload: reloadCleaning, update: updateCleaningCommand, progress: progressCleaningCommand, reportIncident: reportCleaningIncidentCommand }), [progressCleaningCommand, reloadCleaning, reportCleaningIncidentCommand, updateCleaningCommand]);
  const incidentCommands = useMemo(() => ({ reload: reloadIncidents, create: createIncidentCommand, update: updateIncidentCommand, progress: progressIncidentCommand }), [createIncidentCommand, progressIncidentCommand, reloadIncidents, updateIncidentCommand]);
  const maintenanceCommands = useMemo(() => ({ reload: reloadMaintenance, create: createMaintenanceCommand, update: updateMaintenanceCommand, progress: progressMaintenanceCommand }), [createMaintenanceCommand, progressMaintenanceCommand, reloadMaintenance, updateMaintenanceCommand]);
  const restaurantCommands = useMemo(() => ({
    reload: reloadRestaurant,
    createOrder: createOrderCommand,
    updateOrder: updateOrderCommand,
    advanceOrder: advanceOrderCommand,
    cancelOrder: cancelOrderCommand,
    createMenuItem: createMenuItemCommand,
    updateMenuItem: updateMenuItemCommand,
    archiveMenuItem: archiveMenuItemCommand,
    createInventoryItem: createInventoryItemCommand,
    updateInventoryItem: updateInventoryItemCommand,
    adjustInventory: adjustInventoryCommand,
  }), [reloadRestaurant, createOrderCommand, updateOrderCommand, advanceOrderCommand, cancelOrderCommand, createMenuItemCommand, updateMenuItemCommand, archiveMenuItemCommand, createInventoryItemCommand, updateInventoryItemCommand, adjustInventoryCommand]);
  const cashCommands = useMemo(() => ({ reload: reloadCash, open: openCashSessionCommand, count: countCashSessionCommand, close: closeCashSessionCommand, move: createCashMovementCommand }), [openCashSessionCommand, countCashSessionCommand, closeCashSessionCommand, createCashMovementCommand, reloadCash]);
  const parkingCommands = useMemo(() => ({ execute: runParkingCommand, reload: reloadParkingRecords }), [reloadParkingRecords, runParkingCommand]);
  const petCommands = useMemo(() => ({ execute: runPetCommand, reload: reloadPetRecords }), [reloadPetRecords, runPetCommand]);

  const value = useMemo(() => ({ state, dispatch: execute, execute, guestCommands, roomCommands, reservationCommands, stayCommands, cleaningCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands }), [cleaningCommands, execute, guestCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands, reservationCommands, roomCommands, stayCommands, state]);
  return <HotelStateContext.Provider value={value}>{children}</HotelStateContext.Provider>;
}
