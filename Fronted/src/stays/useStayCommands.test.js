import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { checkInReservation } from './staysClient.js';
import { createStayCommands } from './useStayCommands.js';

vi.mock('./staysClient.js', () => ({
  checkInReservation: vi.fn(),
  checkOutStay: vi.fn(),
  createStayCancellationError: vi.fn(() => new Error('superseded')),
  createStayIdempotencyKey: vi.fn(() => 'stay-key'),
  getPersistentStays: vi.fn(),
  StayRequestError: class StayRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const reservationId = '550e8400-e29b-41d4-a716-446655440001';
const stayId = '550e8400-e29b-41d4-a716-446655440002';
const folioId = '550e8400-e29b-41d4-a716-446655440003';
const stayResponse = {
  folio: { id: folioId, openingBalance: '0.00', stayId },
  reservation: { checkInAt: '2026-09-20T15:00:00.000Z', checkOutAt: '2026-09-21T15:00:00.000Z', id: reservationId, status: 'checked_in' },
  room: { id: roomId, status: 'occupied' },
  stay: { checkInAt: '2026-09-20T15:00:00.000Z', checkOutAt: null, id: stayId, reservationId, roomId, status: 'active' },
};

describe('stay commands', () => {
  const permissions = [PERMISSIONS.staysRead, PERMISSIONS.staysCheckIn, PERMISSIONS.reservationsRead, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];
  const authRef = { current: { authStatus: 'authenticated', permissions } };
  const commitInternal = vi.fn();
  const cancelStayCommand = vi.fn();
  const reloadReservations = vi.fn();
  const reloadStays = vi.fn();
  const reloadRooms = vi.fn();
  const reloadCleaning = vi.fn();
  const stayCommandGenerationRef = { current: 0 };
  const stayCommandControllerRef = { current: null };

  const createCommands = () => createStayCommands({
    authRef,
    commitInternal,
    cancelStayCommand,
    reloadReservations,
    reloadStays,
    reloadRooms,
    reloadCleaning,
    stayCommandGenerationRef,
    stayCommandControllerRef,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stayCommandGenerationRef.current = 0;
    stayCommandControllerRef.current = null;
    reloadReservations.mockResolvedValue([]);
    reloadStays.mockResolvedValue([]);
    reloadRooms.mockResolvedValue({ rooms: [], categories: [] });
    reloadCleaning.mockResolvedValue([]);
  });

  it('checks in a reservation and reconciles reservations, stays, rooms and cleaning', async () => {
    vi.mocked(checkInReservation).mockResolvedValue(stayResponse);
    const commands = createCommands();

    await expect(commands.checkIn(reservationId)).resolves.toMatchObject({ stay: { id: stayId, status: 'active' } });

    expect(checkInReservation).toHaveBeenCalledWith(reservationId, {}, expect.any(String), expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'STAY_COMMAND_COMMITTED' }));
    expect(reloadReservations).toHaveBeenCalled();
    expect(reloadStays).toHaveBeenCalled();
    expect(reloadRooms).toHaveBeenCalled();
    expect(reloadCleaning).toHaveBeenCalled();
  });

  it('rejects check-in when the required reception permissions are incomplete', async () => {
    authRef.current.permissions = [PERMISSIONS.staysRead];
    const commands = createCommands();

    await expect(commands.checkIn(reservationId)).rejects.toMatchObject({ status: 403 });
    expect(checkInReservation).not.toHaveBeenCalled();
  });
});
