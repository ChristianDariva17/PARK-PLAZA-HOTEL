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
import { createRoomCancellationError, getRooms, RoomRequestError, setRoomBlocked, updateRoom } from './roomsClient.js';

beforeEach(() => {
  vi.mocked(authRequest).mockReset();
});

describe('room client contract', () => {
  it('forwards GET endpoint and signal', async () => {
    const signal = new AbortController().signal;
    const payload = { rooms: [], categories: [] };
    vi.mocked(authRequest).mockResolvedValue(payload);
    await expect(getRooms(signal)).resolves.toBe(payload);
    expect(authRequest).toHaveBeenCalledWith('/api/rooms', { signal });
  });

  it('forwards update endpoint, method, serialized body, and signal', async () => {
    const signal = new AbortController().signal;
    const body = { number: '102', floor: 1 };
    vi.mocked(authRequest).mockResolvedValue({ id: 'room-id' });
    await updateRoom('room-id', body, signal);
    expect(authRequest).toHaveBeenCalledWith('/api/rooms/room-id', { method: 'PATCH', body: JSON.stringify(body), signal });
  });

  it('forwards block endpoint, method, serialized body, and signal', async () => {
    const signal = new AbortController().signal;
    const body = { blocked: true, reason: 'Inspection' };
    vi.mocked(authRequest).mockResolvedValue({ id: 'room-id' });
    await setRoomBlocked('room-id', body, signal);
    expect(authRequest).toHaveBeenCalledWith('/api/rooms/room-id/block', { method: 'PATCH', body: JSON.stringify(body), signal });
  });

  it.each([
    [400, false],
    [401, false],
    [403, false],
    [404, true],
    [409, true],
  ])('normalizes HTTP %s failures', async (status, reloadRecommended) => {
    vi.mocked(authRequest).mockRejectedValue(new AuthRequestError('unsafe backend detail', status));
    const failure = getRooms().catch((error) => error);
    await expect(failure).resolves.toMatchObject({ name: 'RoomRequestError', status, reloadRecommended });
    await expect(failure).resolves.not.toMatchObject({ message: 'unsafe backend detail' });
  });

  it('creates and returns explicit normalized superseded-operation errors', async () => {
    expect(createRoomCancellationError()).toMatchObject({ code: 'superseded', status: null, reloadRecommended: false });
    const controller = new AbortController();
    controller.abort();
    vi.mocked(authRequest).mockRejectedValue(new AuthRequestError('aborted'));
    await expect(getRooms(controller.signal)).rejects.toMatchObject({ name: 'RoomRequestError', code: 'superseded' });
  });

  it('normalizes non-auth failures without exposing their message', async () => {
    vi.mocked(authRequest).mockRejectedValue(new Error('private transport detail'));
    const error = await getRooms().catch((failure) => failure);
    expect(error).toBeInstanceOf(RoomRequestError);
    expect(error.message).not.toContain('private transport detail');
  });
});
