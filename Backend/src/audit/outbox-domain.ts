const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
]);

export type OutboxFailureKind = 'transient' | 'permanent' | 'unknown';
export type OutboxFailure = { kind: OutboxFailureKind; code: string };

export function classifyOutboxError(error: unknown): OutboxFailure {
  const status = errorField(error, 'statusCode') ?? errorField(error, 'status');
  if (typeof status === 'number' && status >= 500) return { kind: 'transient', code: `HTTP_${status}` };
  if (typeof status === 'number' && (status === 408 || status === 425 || status === 429)) return { kind: 'transient', code: `HTTP_${status}` };
  if (typeof status === 'number' && status >= 400 && status < 500) return { kind: 'permanent', code: `HTTP_${status}` };

  const code = errorField(error, 'code');
  if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)) return { kind: 'transient', code };

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('realtime gateway') || message.includes('socket unavailable') || message.includes('timeout')) {
    return { kind: 'transient', code: 'REALTIME_UNAVAILABLE' };
  }
  return { kind: 'unknown', code: 'OUTBOX_UNKNOWN' };
}

export function retryDelayMs(attempts: number, baseMs: number, maxMs: number, random = Math.random): number {
  const upperBound = Math.max(1, maxMs);
  const base = Math.min(Math.max(1, baseMs), upperBound);
  const exponential = Math.min(upperBound, base * 2 ** Math.min(attempts, 30));
  return Math.min(upperBound, Math.max(1, Math.round(exponential * (0.5 + random()))));
}

function errorField(error: unknown, field: string): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return Reflect.get(error, field);
}
