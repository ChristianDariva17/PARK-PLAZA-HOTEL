import { describe, expect, it } from 'vitest';
import { VALID_ROUTES } from '../components/layout/navigation.js';
import { adminContractMatrix, isAdminContractAdmitted, isCompleteContractMatrix } from './admission.js';

describe('administrative contract admission', () => {
  it('keeps every mounted route in the matrix and only admits confirmed contracts', () => {
    expect(Object.keys(adminContractMatrix).sort()).toEqual([...VALID_ROUTES].sort());
    for (const route of VALID_ROUTES) expect(isAdminContractAdmitted(route)).toBe(true);
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

  it('uses backend document, receivable, and communication contracts', () => {
    expect(adminContractMatrix.contratos.endpoint).toBe('/api/documents/contracts');
    expect(adminContractMatrix.contratos.permission).toBe('contracts.read');
    expect(adminContractMatrix.evidencias.endpoint).toBe('/api/documents/evidences');
    expect(adminContractMatrix.evidencias.permission).toBe('evidence.read');
    expect(adminContractMatrix.auditoria.endpoint).toBe('/api/documents/audit');
    expect(adminContractMatrix.auditoria.permission).toBe('audit.read');
    expect(adminContractMatrix.finanzas.endpoint).toBe('/api/receivables');
    expect(adminContractMatrix.notificaciones.permission).toBe('notifications.read');
    expect(adminContractMatrix.inventario.endpoint).toBe('/api/restaurant/inventory');
    expect(adminContractMatrix.inventario.permission).toBe('inventory.read');
    expect(adminContractMatrix.recreacion.endpoint).toBe('/api/amenities/config');
    expect(adminContractMatrix.recreacion.permission).toBe('reservations.read');
  });
});
