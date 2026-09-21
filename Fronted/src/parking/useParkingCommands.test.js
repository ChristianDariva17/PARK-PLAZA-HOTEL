import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInitialHotelState } from '../domain/hotelModel.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { createVehicle } from './parkingClient.js';
import { createParkingCommands } from './useParkingCommands.js';

vi.mock('./parkingClient.js', () => ({
  ParkingRequestError: class ParkingRequestError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  archiveVehicle: vi.fn(),
  createVehicle: vi.fn(),
  exitVehicle: vi.fn(),
  fetchVehicles: vi.fn(),
  updateVehicle: vi.fn(),
}));

describe('parking commands', () => {
  const authRef = { current: { authStatus: 'authenticated', permissions: [PERMISSIONS.parkingCreate] } };
  const projectedState = { current: getInitialHotelState() };
  const commitInternal = vi.fn();
  const requestGenerationRef = { current: 0 };
  const requestControllerRef = { current: null };

  beforeEach(() => {
    vi.clearAllMocks();
    authRef.current.permissions = [PERMISSIONS.parkingCreate];
    requestGenerationRef.current = 0;
    vi.mocked(createVehicle).mockResolvedValue({ id: 'vehicle-1', vehicleType: 'Auto', fee: '12.00', status: 'Dentro', plate: 'ABC123', space: 'E-01' });
  });

  it('validates and persists a visitor vehicle through the confirmed request policy', async () => {
    const commands = createParkingCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef });
    const action = {
      type: 'PARKING_CREATE',
      responsible: 'Ana',
      payload: { originType: 'visitor', driverName: 'Luis', plate: 'ABC123', space: 'E-01', fee: '12', type: 'Auto' },
    };

    await expect(commands.execute(action)).resolves.toMatchObject({ id: 'vehicle-1', type: 'Auto', fee: 12 });

    expect(createVehicle).toHaveBeenCalledWith(expect.objectContaining({ id: 'VEH-001', driverName: 'Luis', vehicleType: 'Auto', fee: 12 }), expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'PARKING_RECORD_COMMITTED' }));
  });

  it('rejects parking mutations without the action permission', async () => {
    authRef.current.permissions = [];
    const commands = createParkingCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef });

    await expect(commands.execute({ type: 'PARKING_CREATE', payload: { driverName: 'Luis' } })).rejects.toMatchObject({ status: 403 });
    expect(createVehicle).not.toHaveBeenCalled();
  });
});
