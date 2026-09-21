import { describe, expect, it } from 'vitest';
import { sanitizeClientTelemetry } from './clientTelemetry.js';

describe('client telemetry', () => {
  it('reduces routes to resource groups and removes unsafe values', () => {
    expect(sanitizeClientTelemetry({
      kind: 'request',
      outcome: 'failure',
      method: 'GET',
      path: '/api/customers/guest-1?email=guest@example.com',
      status: 403,
      attempt: 1,
      code: 'forbidden detail',
      requestId: 'req-123',
    })).toEqual({
      kind: 'request',
      outcome: 'failure',
      method: 'GET',
      route: '/api/customers',
      statusCode: 403,
      attempt: 1,
      code: 'forbidden_detail',
      requestId: 'req-123',
      metric: null,
      value: null,
    });
  });

  it('accepts bounded web vital measurements without identifiers', () => {
    expect(sanitizeClientTelemetry({
      kind: 'performance',
      outcome: 'measured',
      path: '/',
      metric: 'lcp',
      value: 1234.56789,
    })).toMatchObject({
      kind: 'performance',
      outcome: 'measured',
      route: '/',
      metric: 'lcp',
      value: 1234.568,
      requestId: null,
    });
  });

  it('drops unsupported or unbounded measurements', () => {
    expect(sanitizeClientTelemetry({ kind: 'performance', metric: 'ttfb', value: 20 })).toMatchObject({ metric: null, value: null });
    expect(sanitizeClientTelemetry({ kind: 'performance', metric: 'cls', value: 11 })).toMatchObject({ metric: 'cls', value: null });
  });
});
