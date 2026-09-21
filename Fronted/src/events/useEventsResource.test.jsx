/** @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react/pure';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getSpaces: vi.fn(),
  useWebSocketEvents: vi.fn(),
}));

vi.mock('./eventsClient', () => ({
  eventsClient: {
    getEvents: mocks.getEvents,
    getSpaces: mocks.getSpaces,
  },
}));
vi.mock('../hooks/useWebSocket', () => ({ useWebSocketEvents: mocks.useWebSocketEvents }));

import { useEventsResource } from './useEventsResource.js';

function ResourceProbe({ onChange }) {
  const resource = useEventsResource();
  useEffect(() => onChange(resource), [onChange, resource]);
  return null;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useEventsResource', () => {
  it('loads spaces and events, then coalesces a realtime refresh', async () => {
    const event = { id: 'event-1', title: 'Board meeting' };
    const space = { id: 'space-1', name: 'Room A' };
    let latestResource;
    let refreshFromSocket;
    mocks.getEvents.mockResolvedValue({ items: [event], total: 1 });
    mocks.getSpaces.mockResolvedValue([space]);
    mocks.useWebSocketEvents.mockImplementation((_names, refresh) => {
      refreshFromSocket = refresh;
    });

    render(
      <ResourceProbe
        onChange={(resource) => {
          latestResource = resource;
        }}
      />,
    );

    await waitFor(() => expect(latestResource?.status).toBe('success'));
    expect(latestResource).toMatchObject({ data: [event], events: [event], spaces: [space], total: 1 });
    expect(mocks.useWebSocketEvents).toHaveBeenCalledWith(
      [
        'event:created',
        'event:confirmed',
        'event:status_changed',
        'event:cancelled',
        'event:updated',
        'event:archived',
      ],
      expect.any(Function),
    );

    act(() => refreshFromSocket());
    await waitFor(() => expect(mocks.getEvents).toHaveBeenCalledTimes(2));
  });
});
