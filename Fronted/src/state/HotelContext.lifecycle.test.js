import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./HotelContext.jsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('./hotelContext.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../components/layout/HotelShell.jsx', import.meta.url), 'utf8');

describe('Reservations and stays command ownership', () => {
  it('delegates both bounded contexts while preserving the provider command surface', () => {
    expect(source).toContain("import { useReservationCommands } from '../reservations/useReservationCommands.js';");
    expect(source).toContain("import { useStayCommands } from '../stays/useStayCommands.js';");
    expect(source).toContain('const reservationCommands = useReservationCommands');
    expect(source).toContain('const stayCommands = useStayCommands');
    expect(source).not.toContain('const reservationLifecycleCommand = useCallback');
    expect(source).not.toContain('const runStayCommand = useCallback');
  });
});

describe('Cash command ownership', () => {
  it('delegates cash lifecycle and commands while preserving the provider command surface', () => {
    expect(source).toContain("import { useCashCommands } from '../cash/useCashCommands.js';");
    expect(source).toContain('const cashCommands = useCashCommands');
    expect(source).not.toContain('const runCashLoad = useCallback');
    expect(source).not.toContain('const openCashSessionCommand = useCallback');
    expect(source).not.toContain('const createCashMovementCommand = useCallback');
  });
});

describe('Cleaning, incident and maintenance command ownership', () => {
  it('delegates the coordinated operational group to one controller', () => {
    expect(source).toContain("import { useOperationalCommands } from '../operations/useOperationalCommands.js';");
    expect(source).toContain('const { cleaningCommands, incidentCommands, maintenanceCommands } = useOperationalCommands');
    expect(source).not.toContain('const runCleaningLoad = useCallback');
    expect(source).not.toContain('const createIncidentCommand = useCallback');
    expect(source).not.toContain('const createMaintenanceCommand = useCallback');
  });
});

describe('Parking and pet command ownership', () => {
  it('delegates confirmed parking and pet mutations to feature controllers', () => {
    expect(source).toContain("import { useParkingCommands } from '../parking/useParkingCommands.js';");
    expect(source).toContain("import { usePetCommands } from '../pets/usePetCommands.js';");
    expect(source).toContain('const parkingCommands = useParkingCommands');
    expect(source).toContain('const petCommands = usePetCommands');
    expect(source).not.toContain('const runParkingCommand = useCallback');
    expect(source).not.toContain('const runPetCommand = useCallback');
  });
});

describe('HotelContext shell state isolation', () => {
  it('publishes a stable shell slice instead of subscribing the shell to every domain', () => {
    expect(contextSource).toContain('HotelShellStateContext');
    expect(contextSource).toContain('HotelSearchStateContext');
    expect(contextSource).toContain('useHotelShellState');
    expect(contextSource).toContain('useHotelSearchState');
    expect(source).toContain('const shellState = useMemo');
    expect(source).toContain('const searchState = useMemo');
    expect(source).toContain('HotelShellStateContext.Provider value={shellState}');
    expect(shellSource).toContain('const shellState = useHotelShellState()');
    expect(appSource).not.toContain('state={state}');
    expect(shellSource).toContain("useWebSocketEvents(['room:updated', 'room:status_changed', 'room:category_updated']");
    expect(shellSource).toContain('roomReloadTimerRef');
  });
});

describe('Restaurant resource ownership', () => {
  it('delegates restaurant reads to the feature controller while preserving the public reload command', () => {
    expect(source).toContain("import { useRestaurantResources } from '../restaurant/useRestaurantResources.js';");
    expect(source).toContain('const { reloadResource } = useRestaurantResources');
    expect(source).not.toContain('const RESTAURANT_RESOURCE_DEFINITIONS');
    expect(source).not.toContain('const resourceRefs = useRef');
    expect(source).not.toContain('const runResourceLoad = useCallback');
  });
});

describe('Restaurant order command ownership', () => {
  it('delegates order mutations while preserving the provider command surface', () => {
    expect(source).toContain("import { useRestaurantOrderCommands } from '../restaurant/useRestaurantOrderCommands.js';");
    expect(source).toContain('const restaurantOrderCommands = useRestaurantOrderCommands');
    expect(source).toContain('...restaurantOrderCommands');
    expect(source).not.toContain('const createOrderCommand = useCallback');
    expect(source).not.toContain('const cancelOrderCommand = useCallback');
  });
});

describe('Restaurant inventory command ownership', () => {
  it('delegates inventory mutations while preserving the inventory command surface', () => {
    expect(source).toContain("import { useRestaurantInventoryCommands } from '../restaurant/useRestaurantInventoryCommands.js';");
    expect(source).toContain('const inventoryCommands = useRestaurantInventoryCommands');
    expect(source).not.toContain('const createInventoryItemCommand = useCallback');
    expect(source).not.toContain('const adjustInventoryCommand = useCallback');
  });
});

describe('Restaurant menu command ownership', () => {
  it('delegates managed menu and import commands to the feature controller', () => {
    expect(source).toContain("import { useRestaurantMenuCommands } from '../restaurant/useRestaurantMenuCommands.js';");
    expect(source).toContain('const menuManagementCommands = useRestaurantMenuCommands');
    expect(source).not.toContain('const runManagedMenuLoad = useCallback');
    expect(source).not.toContain('const applyImportCommand = useCallback');
  });
});

describe('Guest and room command ownership', () => {
  it('delegates both bounded contexts while preserving the provider command surface', () => {
    expect(source).toContain("import { useGuestCommands } from '../guests/useGuestCommands.js';");
    expect(source).toContain("import { useRoomCommands } from '../rooms/useRoomCommands.js';");
    expect(source).toContain('const guestCommands = useGuestCommands');
    expect(source).toContain('const roomCommands = useRoomCommands');
    expect(source).not.toContain('const runGuestLoad = useCallback');
    expect(source).not.toContain('const runRoomLoad = useCallback');
    expect(source).not.toContain('const createGuestCommand = useCallback');
    expect(source).not.toContain('const updateRoomCommand = useCallback');
  });
});
