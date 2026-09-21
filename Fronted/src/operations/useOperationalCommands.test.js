import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { createCleaningTask } from '../cleaning/cleaningClient.js';
import { createIncident } from '../incidents/incidentsClient.js';
import { createMaintenanceTicket } from '../maintenance/maintenanceClient.js';
import { createOperationalCommands } from './useOperationalCommands.js';

vi.mock('../cleaning/cleaningClient.js', () => ({
  CleaningRequestError: class CleaningRequestError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  createCleaningIdempotencyKey: vi.fn(() => 'cleaning-key'),
  createCleaningTask: vi.fn(),
  getCleaningTasks: vi.fn(),
  progressCleaningTask: vi.fn(),
  reportCleaningIncident: vi.fn(),
  updateCleaningTask: vi.fn(),
}));

vi.mock('../incidents/incidentsClient.js', () => ({
  IncidentRequestError: class IncidentRequestError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  createIncident: vi.fn(),
  getIncidents: vi.fn(),
  progressIncident: vi.fn(),
  updateIncident: vi.fn(),
}));

vi.mock('../maintenance/maintenanceClient.js', () => ({
  MaintenanceRequestError: class MaintenanceRequestError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  createMaintenanceTicket: vi.fn(),
  getMaintenanceTickets: vi.fn(),
  progressMaintenanceTicket: vi.fn(),
  updateMaintenanceTicket: vi.fn(),
}));

const cleaningTask = { id: 'cleaning-1', roomId: 'room-1', status: 'pending' };
const incident = { id: 'incident-1', roomId: 'room-1', type: 'cleaning', description: 'Leak', priority: 'high', status: 'pending' };
const maintenanceTicket = { id: 'maintenance-1', roomId: 'room-1', type: 'maintenance', description: 'Broken lock', priority: 'high', status: 'pending' };

describe('operational command ownership', () => {
  const permissions = [
    PERMISSIONS.cleaningAssign,
    PERMISSIONS.cleaningProgress,
    PERMISSIONS.cleaningReportIncident,
    PERMISSIONS.incidentsCreate,
    PERMISSIONS.incidentsUpdate,
    PERMISSIONS.incidentsProgress,
    PERMISSIONS.maintenanceCreate,
    PERMISSIONS.maintenanceUpdate,
    PERMISSIONS.maintenanceProgress,
  ];
  const authRef = {
    current: {
      authStatus: 'authenticated',
      permissions,
      cleaningCommandGenerationRef: { current: 0 },
      cleaningCommandControllerRef: { current: null },
      maintenanceCommandGenerationRef: { current: 0 },
      maintenanceCommandControllerRef: { current: null },
    },
  };
  const commitInternal = vi.fn();
  const cancelCleaningCommand = vi.fn();
  const cancelMaintenanceCommand = vi.fn();
  const reloadCleaning = vi.fn(() => Promise.resolve());
  const reloadIncidents = vi.fn(() => Promise.resolve());
  const reloadMaintenance = vi.fn(() => Promise.resolve());
  const reloadRooms = vi.fn(() => Promise.resolve());

  const createCommands = (currentPermissions = permissions) => {
    authRef.current.permissions = currentPermissions;
    return createOperationalCommands({ authRef, commitInternal, cancelCleaningCommand, cancelMaintenanceCommand, reloadCleaning, reloadIncidents, reloadMaintenance, reloadRooms });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authRef.current.permissions = permissions;
    authRef.current.cleaningCommandGenerationRef.current = 0;
    authRef.current.maintenanceCommandGenerationRef.current = 0;
    vi.mocked(createCleaningTask).mockResolvedValue(cleaningTask);
    vi.mocked(createIncident).mockResolvedValue(incident);
    vi.mocked(createMaintenanceTicket).mockResolvedValue(maintenanceTicket);
  });

  it('keeps cleaning mutations authoritative when one related read is unavailable', async () => {
    reloadCleaning.mockRejectedValue(new Error('cleaning read denied'));
    reloadRooms.mockRejectedValue(new Error('rooms read denied'));
    reloadIncidents.mockRejectedValue(new Error('incidents read denied'));
    const commands = createCommands([PERMISSIONS.cleaningAssign]);

    await expect(commands.cleaningCommands.create('room-1', 'Check-out', '', 'Ana')).resolves.toMatchObject({ id: 'cleaning-1', status: 'Pendiente' });

    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLEANING_COMMAND_COMMITTED' }));
    expect(commitInternal).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CLEANING_COMMAND_FAILED' }));
  });

  it('adapts API task and room states before committing a cleaning mutation', async () => {
    vi.mocked(createCleaningTask).mockResolvedValue({
      task: { ...cleaningTask, status: 'pending' },
      room: { id: 'room-1', status: 'cleaning' },
    });
    const commands = createCommands([PERMISSIONS.cleaningAssign]);

    await expect(commands.cleaningCommands.create('room-1', 'Check-out', '', 'Ana')).resolves.toMatchObject({
      id: 'cleaning-1',
      status: 'Pendiente',
    });

    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CLEANING_COMMAND_COMMITTED',
      task: expect.objectContaining({ status: 'Pendiente' }),
      room: { id: 'room-1', status: 'En limpieza' },
    }));
  });

  it('enforces write permissions in incident and maintenance commands', async () => {
    const commands = createCommands([PERMISSIONS.incidentsCreate, PERMISSIONS.maintenanceCreate]);

    await expect(commands.incidentCommands.create(incident)).resolves.toMatchObject({ id: 'incident-1', status: 'Pendiente' });
    await expect(commands.maintenanceCommands.create(maintenanceTicket)).resolves.toMatchObject({ id: 'maintenance-1', status: 'Pendiente' });
    await expect(commands.incidentCommands.update('incident-1', {})).rejects.toMatchObject({ status: 403 });
    await expect(commands.maintenanceCommands.update('maintenance-1', {})).rejects.toMatchObject({ status: 403 });
  });
});
