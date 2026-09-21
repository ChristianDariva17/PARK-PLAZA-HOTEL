import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { createReservation, confirmReservation, createReservationIdempotencyKey } from './reservationsClient.js';
import { createReservationCommands } from './useReservationCommands.js';

vi.mock('./reservationsClient.js', () => ({
  cancelReservation: vi.fn(),
  confirmReservation: vi.fn(),
  createReservation: vi.fn(),
  createReservationCancellationError: vi.fn(() => new Error('superseded')),
  createReservationIdempotencyKey: vi.fn(() => 'reservation-key'),
  dispositionReservation: vi.fn(),
  getReservationAvailability: vi.fn(),
  getReservationDetail: vi.fn(),
  getReservations: vi.fn(),
  ReservationRequestError: class ReservationRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const guestId = '550e8400-e29b-41d4-a716-446655440001';
const reservationId = '550e8400-e29b-41d4-a716-446655440002';
const createInput = {
  checkInAt: '2026-09-20T15:00:00.000Z',
  checkOutAt: '2026-09-21T15:00:00.000Z',
  guestCount: 2,
  primaryGuestId: guestId,
  roomId,
};
const reservationResponse = {
  checkInAt: createInput.checkInAt,
  checkOutAt: createInput.checkOutAt,
  createdAt: '2026-09-15T00:00:00.000Z',
  guestCount: 2,
  id: reservationId,
  nightlyRate: '95.00',
  primaryGuestId: guestId,
  roomId,
  status: 'pending',
  totalAmount: '95.00',
  updatedAt: '2026-09-15T00:00:00.000Z',
};
const detailResponse = {
  checkIn: '2026-09-20',
  checkInAt: createInput.checkInAt,
  checkOut: '2026-09-21',
  checkOutAt: createInput.checkOutAt,
  createdAt: '2026-09-15T00:00:00.000Z',
  guestCount: 2,
  id: reservationId,
  lifecycle: { changedAt: null, reason: null },
  nightlyRate: '95.00',
  permittedActions: ['confirm'],
  primaryGuest: { documentNumber: '12345678', documentType: 'DNI', id: guestId, name: 'Ana Torres' },
  room: { floor: 1, id: roomId, number: '101' },
  status: 'pending',
  totalAmount: '95.00',
  updatedAt: '2026-09-15T00:00:00.000Z',
};

describe('reservation commands', () => {
  const permissions = [PERMISSIONS.reservationsRead, PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead, PERMISSIONS.reservationsUpdate];
  const authRef = { current: { authStatus: 'authenticated', permissions } };
  const commitInternal = vi.fn();
  const reloadReservations = vi.fn();
  const loadReservationAvailability = vi.fn();
  const refreshReservationBoundary = vi.fn();
  const reservationCreateGenerationRef = { current: 0 };
  const reservationCreateControllerRef = { current: null };
  const reservationLifecycleGenerationRef = { current: 0 };
  const reservationLifecycleControllerRef = { current: null };

  const createCommands = () => createReservationCommands({
    authRef,
    commitInternal,
    reloadReservations,
    loadReservationAvailability,
    refreshReservationBoundary,
    reservationCreateGenerationRef,
    reservationCreateControllerRef,
    reservationLifecycleGenerationRef,
    reservationLifecycleControllerRef,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    reservationCreateGenerationRef.current = 0;
    reservationLifecycleGenerationRef.current = 0;
    reservationCreateControllerRef.current = null;
    reservationLifecycleControllerRef.current = null;
    reloadReservations.mockResolvedValue([]);
    loadReservationAvailability.mockResolvedValue({ rooms: [] });
  });

  it('creates a reservation and reconciles the authoritative boundaries', async () => {
    vi.mocked(createReservation).mockResolvedValue(reservationResponse);
    const commands = createCommands();

    await expect(commands.create(createInput)).resolves.toMatchObject({ id: reservationId, status: 'pending' });

    expect(createReservation).toHaveBeenCalledWith(createInput, expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESERVATION_CREATE_COMMITTED' }));
    expect(reloadReservations).toHaveBeenCalled();
    expect(loadReservationAvailability).toHaveBeenCalledWith(expect.objectContaining({ guestCount: 2 }));
  });

  it('executes a lifecycle command with an idempotency key and reloads reservations', async () => {
    vi.mocked(confirmReservation).mockResolvedValue({ replayed: false, reservation: detailResponse });
    const commands = createCommands();

    await expect(commands.lifecycle(reservationId, 'confirm')).resolves.toMatchObject({ replayed: false });

    expect(createReservationIdempotencyKey).toHaveBeenCalled();
    expect(confirmReservation).toHaveBeenCalledWith(reservationId, 'reservation-key', expect.any(AbortSignal));
    expect(reloadReservations).toHaveBeenCalled();
  });
});
