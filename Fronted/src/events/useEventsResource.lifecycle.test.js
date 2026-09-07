import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./useEventsResource.js', import.meta.url), 'utf8');

describe('events realtime reload policy', () => {
  it('coalesces realtime events and cancels stale loads', () => {
    expect(source).toContain('useWebSocketEvents(EVENT_REFRESH_NAMES, refresh)');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain('request.controller?.abort()');
    expect(source).toContain('generation !== eventsRequestRef.current.generation');
  });
});
