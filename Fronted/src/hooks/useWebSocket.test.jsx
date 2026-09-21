/** @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react/pure';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addConnectionListener: vi.fn(),
  connectSocket: vi.fn(),
  getSocket: vi.fn(),
  subscribeToEvent: vi.fn(),
}));

vi.mock('../realtime/socketClient.js', () => mocks);

import { useWebSocketEvents } from './useWebSocket.js';

function WebSocketProbe({ onState, onEvent }) {
  const state = useWebSocketEvents(['room:updated', 'room:closed'], onEvent);
  useEffect(() => onState(state), [onState, state]);
  return null;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useWebSocketEvents', () => {
  it('connects, exposes connection state, forwards events, and unsubscribes on unmount', async () => {
    const socket = { id: 'socket-1' };
    const connectionListener = vi.fn();
    const eventUnsubscribers = [vi.fn(), vi.fn()];
    let eventHandlers = [];
    mocks.connectSocket.mockReturnValue(socket);
    mocks.getSocket.mockReturnValue(socket);
    mocks.addConnectionListener.mockImplementation((listener) => {
      connectionListener.mockImplementation(listener);
      return vi.fn();
    });
    mocks.subscribeToEvent.mockImplementation((_eventName, handler) => {
      eventHandlers.push(handler);
      return eventUnsubscribers[eventHandlers.length - 1];
    });
    const onState = vi.fn();
    const onEvent = vi.fn();
    const { unmount } = render(<WebSocketProbe onState={onState} onEvent={onEvent} />);

    expect(mocks.connectSocket).toHaveBeenCalledOnce();
    expect(mocks.subscribeToEvent).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith({ isConnected: false, status: 'connecting', socket });

    act(() => connectionListener(true, 'connected'));
    expect(onState).toHaveBeenLastCalledWith({ isConnected: true, status: 'connected', socket });

    act(() => eventHandlers[0]({ id: 'event-1' }));
    expect(onEvent).toHaveBeenCalledWith({ id: 'event-1' });

    unmount();
    await waitFor(() => {
      expect(eventUnsubscribers[0]).toHaveBeenCalledOnce();
      expect(eventUnsubscribers[1]).toHaveBeenCalledOnce();
    });
  });
});
