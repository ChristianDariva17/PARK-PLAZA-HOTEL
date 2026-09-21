import { describe, expect, it } from 'vitest';
import { normalizeRequestError, RequestError } from './requestError.js';

describe('request error contract', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation'],
    [429, 'rate_limited'],
    [500, 'server'],
  ])('maps HTTP status %s to %s', (status, type) => {
    expect(normalizeRequestError(new RequestError('safe message', { status }))).toMatchObject({ status, type, message: 'safe message' });
  });

  it('preserves correlation and reconciliation metadata without the original cause', () => {
    const cause = new Error('private transport detail');
    const normalized = normalizeRequestError(new RequestError('Safe failure', {
      status: 503,
      code: 'upstream_unavailable',
      ambiguous: true,
      reloadRecommended: true,
      requestId: 'req-123',
      cause,
    }));

    expect(normalized).toEqual({
      message: 'Safe failure',
      status: 503,
      code: 'upstream_unavailable',
      type: 'ambiguous',
      retryable: false,
      ambiguous: true,
      reloadRecommended: true,
      requestId: 'req-123',
      fieldErrors: null,
    });
    expect(normalized).not.toHaveProperty('cause');
  });

  it('replaces unknown errors with a safe network message', () => {
    expect(normalizeRequestError(new Error('database password'))).toMatchObject({
      message: 'No se pudo completar la solicitud. Intentá nuevamente.',
      status: null,
      type: 'network',
    });
  });
});
