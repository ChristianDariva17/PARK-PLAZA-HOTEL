import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRequestError, authRequest, createIdempotencyKey } from './authClient.js';

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: () => Promise.resolve(payload),
});

afterEach(() => vi.unstubAllGlobals());

describe('authRequest retry and correlation contract', () => {
  it('retries a transient GET once and preserves the response value', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(jsonResponse(200, { rooms: [] }));
    vi.stubGlobal('fetch', fetch);

    await expect(authRequest('/api/rooms')).resolves.toEqual({ rooms: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry mutations and exposes a correlated domain error', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(503, { code: 'upstream_unavailable', requestId: 'req-123', message: 'internal detail' }));
    vi.stubGlobal('fetch', fetch);

    await expect(authRequest('/api/rooms', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      name: 'AuthRequestError', status: 503, code: 'upstream_unavailable', requestId: 'req-123', retryable: false, ambiguous: true, reloadRecommended: true,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the legacy status constructor form for domain clients', () => {
    expect(new AuthRequestError('rejected', 403)).toMatchObject({ status: 403, code: 'transport' });
  });

  it('rejects an unavailable or malformed idempotency key locally', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'not-a-uuid' });
    expect(createIdempotencyKey).toThrow('cannot create a required idempotency key');
  });
});
