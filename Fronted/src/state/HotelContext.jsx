import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth, usePermissions } from '../auth/authContext.js';
import { permissionForAction } from '../auth/permissions.js';
import { getInitialHotelState } from '../domain/hotelModel.js';

// Restaurant
import { useRestaurantResources } from '../restaurant/useRestaurantResources.js';
import { useRestaurantOrderCommands } from '../restaurant/useRestaurantOrderCommands.js';
import { useRestaurantInventoryCommands } from '../restaurant/useRestaurantInventoryCommands.js';
import { useRestaurantMenuCommands } from '../restaurant/useRestaurantMenuCommands.js';
import { useGuestCommands } from '../guests/useGuestCommands.js';
import { useRoomCommands } from '../rooms/useRoomCommands.js';
import { useReservationCommands } from '../reservations/useReservationCommands.js';
import { useStayCommands } from '../stays/useStayCommands.js';
import { useCashCommands } from '../cash/useCashCommands.js';
import { useOperationalCommands } from '../operations/useOperationalCommands.js';

import { HotelCommandsContext, HotelDashboardStateContext, HotelSearchStateContext, HotelShellStateContext, HotelStateContext } from './hotelContext.js';
import { hotelReducer, validateHotelAction } from './hotelReducer.js';
import { useParkingCommands } from '../parking/useParkingCommands.js';
import { usePetCommands } from '../pets/usePetCommands.js';

export function HotelProvider({ children }) {
  const { status: authStatus, account, permissions = [] } = useAuth();
  const { can } = usePermissions();
  const [state, reducerDispatch] = useReducer(hotelReducer, undefined, getInitialHotelState);
  const projectedState = useRef(state);
  useLayoutEffect(() => {
    projectedState.current = state;
  }, [state]);

  const commitInternal = useCallback((action) => {
    projectedState.current = hotelReducer(projectedState.current, action);
    reducerDispatch(action);
  }, []);

  const { reloadResource } = useRestaurantResources({ authStatus, account, permissions, commitInternal });
  const restaurantOrderCommands = useRestaurantOrderCommands({ commitInternal, reloadResource });
  const inventoryCommands = useRestaurantInventoryCommands({ permissions, commitInternal, reloadResource });
  const menuManagementCommands = useRestaurantMenuCommands({ authStatus, permissions, commitInternal, reloadResource, projectedState });

  const guestCommands = useGuestCommands({ authStatus, account, permissions, commitInternal, projectedState });
  const roomCommands = useRoomCommands({ authStatus, account, permissions, commitInternal, projectedState });
  const { reload: reloadRooms } = roomCommands;
  const cashCommands = useCashCommands({ authStatus, account, permissions, commitInternal, projectedState });
  const { cleaningCommands, incidentCommands, maintenanceCommands } = useOperationalCommands({ authStatus, account, permissions, commitInternal, projectedState, reloadRooms });
  const { reload: reloadCleaning } = cleaningCommands;
  const parkingCommands = useParkingCommands({ authStatus, account, permissions, commitInternal, projectedState });
  const petCommands = usePetCommands({ authStatus, account, permissions, commitInternal, projectedState });

  const reservationCommands = useReservationCommands({ authStatus, account, permissions, commitInternal, projectedState });
  const { reload: reloadReservations } = reservationCommands;
  const stayCommands = useStayCommands({ authStatus, account, permissions, commitInternal, projectedState, reloadReservations, reloadCleaning, reloadRooms });

  const execute = useCallback((action) => {
    const requiredPermission = permissionForAction(action);
    if (requiredPermission && !(Array.isArray(requiredPermission) ? requiredPermission.some(can) : can(requiredPermission))) return { ok: false, error: 'No tenés permiso para realizar esta operación.' };
    if (action.type.startsWith('PARKING_') || action.type.startsWith('PET_')) return { ok: false, error: 'Esta operación requiere confirmación del servidor.' };
    const result = validateHotelAction(projectedState.current, action);
    if (result.ok) {
      projectedState.current = hotelReducer(projectedState.current, action);
      reducerDispatch(action);

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
  }, [can]);

  const restaurantCommands = useMemo(() => ({
    reload: () => { reloadResource('menu'); reloadResource('orders'); },
    reloadResource,
    ...restaurantOrderCommands,
  }), [reloadResource, restaurantOrderCommands]);
  const shellState = useMemo(() => ({
    orders: state.orders,
    notifications: state.notifications,
  }), [state.orders, state.notifications]);
  const searchState = useMemo(() => ({
    clients: state.clients,
    reservations: state.reservations,
    rooms: state.rooms,
    orders: state.orders,
  }), [state.clients, state.reservations, state.rooms, state.orders]);
  const dashboardState = useMemo(() => ({
    rooms: state.rooms,
    incidents: state.incidents,
    inventory: state.inventory,
    cashMovements: state.cashMovements,
    accounts: state.accounts,
    orders: state.orders,
    reservations: state.reservations,
    stays: state.stays,
    recreationAccess: state.recreationAccess,
    poolCapacity: state.poolCapacity,
    cleaningTasks: state.cleaningTasks,
    maintenanceTickets: state.maintenanceTickets,
    events: state.events,
    auditLog: state.auditLog,
    clients: state.clients,
  }), [state.accounts, state.auditLog, state.cashMovements, state.cleaningTasks, state.clients, state.events, state.incidents, state.inventory, state.maintenanceTickets, state.orders, state.poolCapacity, state.recreationAccess, state.reservations, state.rooms, state.stays]);

  const commands = useMemo(() => ({ dispatch: execute, execute, guestCommands, roomCommands, reservationCommands, stayCommands, cleaningCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands, menuManagementCommands, inventoryCommands }), [cleaningCommands, execute, guestCommands, incidentCommands, maintenanceCommands, cashCommands, parkingCommands, petCommands, restaurantCommands, menuManagementCommands, inventoryCommands, reservationCommands, roomCommands, stayCommands]);
  return <HotelCommandsContext.Provider value={commands}><HotelShellStateContext.Provider value={shellState}><HotelSearchStateContext.Provider value={searchState}><HotelDashboardStateContext.Provider value={dashboardState}><HotelStateContext.Provider value={state}>{children}</HotelStateContext.Provider></HotelDashboardStateContext.Provider></HotelSearchStateContext.Provider></HotelShellStateContext.Provider></HotelCommandsContext.Provider>;
}
