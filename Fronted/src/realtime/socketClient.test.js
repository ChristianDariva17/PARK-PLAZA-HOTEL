import { afterEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { location: { origin: 'http://localhost' } };

const socket = {
  connected: false,
  connect: vi.fn(function connect() { this.connected = true; }),
  disconnect: vi.fn(function disconnect() { this.connected = false; }),
  on: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

const { connectSocket, disconnectSocket, getSocket, subscribeToEvent } = await import('./socketClient.js');

afterEach(() => {
  disconnectSocket();
  vi.clearAllMocks();
  socket.connected = false;
});

describe('staff socket lifecycle', () => {
  it('creates a connection only when explicitly requested and discards it on logout', async () => {
    expect(getSocket()).toBeNull();

    const connected = connectSocket();
    const unsubscribe = subscribeToEvent('room:updated', vi.fn());

    expect(connected).toBe(socket);
    expect(getSocket()).toBe(socket);
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(socket.on).toHaveBeenCalledWith('room:updated', expect.any(Function));

    unsubscribe();
    disconnectSocket();

    expect(socket.off).toHaveBeenCalledWith('room:updated', expect.any(Function));
    expect(socket.removeAllListeners).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(getSocket()).toBeNull();
  });
});
