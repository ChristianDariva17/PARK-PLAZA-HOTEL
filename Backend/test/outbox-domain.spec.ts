import { describe, expect, it } from 'vitest';
import { classifyOutboxError, retryDelayMs } from '../src/audit/outbox-domain.js';

describe('outbox domain policies', () => {
  it('classifies HTTP, transport and realtime failures without infrastructure dependencies', () => {
    expect(classifyOutboxError({ statusCode: 503 })).toEqual({ kind: 'transient', code: 'HTTP_503' });
    expect(classifyOutboxError({ status: 429 })).toEqual({ kind: 'transient', code: 'HTTP_429' });
    expect(classifyOutboxError({ status: 404 })).toEqual({ kind: 'permanent', code: 'HTTP_404' });
    expect(classifyOutboxError({ code: 'ECONNRESET' })).toEqual({ kind: 'transient', code: 'ECONNRESET' });
    expect(classifyOutboxError(new Error('Realtime gateway is unavailable'))).toEqual({ kind: 'transient', code: 'REALTIME_UNAVAILABLE' });
    expect(classifyOutboxError(new Error('unexpected failure'))).toEqual({ kind: 'unknown', code: 'OUTBOX_UNKNOWN' });
  });

  it('applies bounded exponential backoff with injectable jitter', () => {
    expect(retryDelayMs(0, 100, 1_000, () => 0)).toBe(50);
    expect(retryDelayMs(3, 100, 1_000, () => 0)).toBe(400);
    expect(retryDelayMs(10, 100, 1_000, () => 1)).toBe(1_000);
    expect(retryDelayMs(0, 0, 0, () => 0)).toBe(1);
  });
});
