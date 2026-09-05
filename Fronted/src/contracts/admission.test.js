import { describe, expect, it } from 'vitest';
import { VALID_ROUTES } from '../components/layout/navigation.js';
import { adminContractMatrix, isAdminContractAdmitted, isCompleteContractMatrix } from './admission.js';

describe('administrative contract admission', () => {
  it('keeps every mounted route in the matrix and only admits confirmed contracts', () => {
    expect(Object.keys(adminContractMatrix).sort()).toEqual([...VALID_ROUTES].sort());
    for (const route of VALID_ROUTES) {
      expect(isAdminContractAdmitted(route)).toBe(route !== 'dashboard');
    }
  });

  it('requires every backend admission field before a route can be activated', () => {
    const complete = {
      route: 'example', endpoint: '/api/example', dto: 'ExampleDto', session: 'admin', permission: 'example.read',
      propertyScope: 'server-enforced', errors: [401, 403, 404, 409, 422], money: 'exact-decimal-string',
      idempotency: 'required', invalidates: ['example'], approved: true, verified: true,
    };
    expect(isCompleteContractMatrix(complete)).toBe(true);
    expect(isCompleteContractMatrix({ ...complete, propertyScope: 'client-only' })).toBe(false);
  });
});
