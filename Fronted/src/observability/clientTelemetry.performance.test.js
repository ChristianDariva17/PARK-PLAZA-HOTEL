// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startClientTelemetry } from './clientTelemetry.js';

const observers = new Map();

class FakePerformanceObserver {
  static supportedEntryTypes = ['largest-contentful-paint', 'event', 'layout-shift'];

  constructor(callback) {
    this.callback = callback;
  }

  observe({ type }) {
    observers.set(type, this);
  }

  disconnect() {}
}

function emit(type, entries) {
  observers.get(type)?.callback({ getEntries: () => entries });
}

describe('client Web Vitals telemetry', () => {
  let stop;

  afterEach(() => {
    stop?.();
    observers.clear();
    vi.restoreAllMocks();
  });

  it('reports one bounded sample for each supported vital on page hide', () => {
    Object.defineProperty(globalThis, 'PerformanceObserver', { configurable: true, value: FakePerformanceObserver });
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
    stop = startClientTelemetry();

    emit('largest-contentful-paint', [{ startTime: 2_100 }]);
    emit('event', [{ interactionId: 1, duration: 120 }]);
    emit('layout-shift', [{ hadRecentInput: false, startTime: 2_200, value: 0.12 }]);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledTimes(3);
  });
});
