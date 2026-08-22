import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/authClient.js', () => {
  class AuthRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'AuthRequestError';
      this.status = status;
    }
  }
  return { AuthRequestError, authRequest: vi.fn() };
});

import { AuthRequestError, authRequest } from '../auth/authClient.js';
import { createReservation, createReservationCancellationError, getReservationAvailability, getReservations, ReservationRequestError } from './reservationsClient.js';

beforeEach(() => {
  vi.mocked(authRequest).mockReset();
});

describe('reservation client contract', () => {
  it('forwards list endpoint and cancellation signal', async () => {
    const signal = new AbortController().signal;
    vi.mocked(authRequest).mockResolvedValue([]);
    await expect(getReservations(signal)).resolves.toEqual([]);
    expect(authRequest).toHaveBeenCalledWith('/api/reservations', { signal });
  });

  it('serializes the exact availability query', async () => {
    const signal = new AbortController().signal;
    const query = { checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 2 };
    vi.mocked(authRequest).mockResolvedValue({ rooms: [] });
    await getReservationAvailability(query, signal);
    expect(authRequest).toHaveBeenCalledWith('/api/reservations/availability?checkInAt=2028-02-28T15%3A00%3A00.000Z&checkOutAt=2028-03-01T11%3A00%3A00.000Z&guestCount=2', { signal });
  });

  it('serializes create body and forwards cancellation signal', async () => {
    const signal = new AbortController().signal;
    const body = { roomId: 'room-id', primaryGuestId: 'guest-id', checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 2 };
    vi.mocked(authRequest).mockResolvedValue({ id: 'reservation-id' });
    await createReservation(body, signal);
    expect(authRequest).toHaveBeenCalledWith('/api/reservations', { method: 'POST', body: JSON.stringify(body), signal });
  });

  it.each([[400, false], [401, false], [403, false], [404, true], [409, true]])('normalizes HTTP %s without exposing backend details', async (status, reloadRecommended) => {
    vi.mocked(authRequest).mockRejectedValue(new AuthRequestError('unsafe backend detail', status));
    const error = await getReservations().catch((failure) => failure);
    expect(error).toMatchObject({ name: 'ReservationRequestError', status, reloadRecommended, ambiguous: false });
    expect(error.message).not.toContain('unsafe backend detail');
  });

  it('marks network and server failures as ambiguous and reload-required', async () => {
    for (const failure of [new Error('private transport detail'), new AuthRequestError('unsafe server detail', 500)]) {
      vi.mocked(authRequest).mockRejectedValueOnce(failure);
      await expect(createReservation({})).rejects.toMatchObject({ name: 'ReservationRequestError', code: 'ambiguous', reloadRecommended: true, ambiguous: true });
    }
  });

  it('returns explicit superseded errors for aborted operations', async () => {
    expect(createReservationCancellationError()).toBeInstanceOf(ReservationRequestError);
    const controller = new AbortController();
    controller.abort();
    vi.mocked(authRequest).mockRejectedValue(new AuthRequestError('aborted'));
    await expect(getReservations(controller.signal)).rejects.toMatchObject({ code: 'superseded', ambiguous: false });
  });
});
