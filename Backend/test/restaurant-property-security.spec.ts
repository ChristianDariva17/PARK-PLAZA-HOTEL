import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import type { FolioService } from '../src/folios/folio.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import { RestaurantService } from '../src/restaurant/restaurant.service.js';

const actor = { accountId: 'account', propertyId: 'property', email: 'restaurant@example.invalid', permissions: [], roleKey: 'restaurant', sessionId: 'session', passwordChangeRequired: false } satisfies AuthenticatedAccount;

function query(value: unknown) {
  const chain: any = {};
  for (const method of ['from', 'where', 'limit', 'for', 'orderBy']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

function setup(selections: unknown[][]) {
  const tx = {
    select: vi.fn(() => query(selections.shift() ?? [])),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const database = { transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)) } as unknown as Database;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new RestaurantService(database, {} as FolioService, audit), tx };
}

describe('Restaurant property reference enforcement', () => {
  it('rejects an ingredient reference that is not active in the actor property before writing', async () => {
    const { service, tx } = setup([[], [], []]);
    await expect(service.createMenuItem(actor, {
      name: 'Manual product', category: 'Comidas', salePrice: 10, preparationMinutes: 10,
      description: null, ingredients: [{ inventoryItemId: '00000000-0000-4000-8000-000000000001', quantity: 1 }],
    }, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('rejects a stay reference outside the actor property before creating an order', async () => {
    const { service, tx } = setup([[], []]);
    await expect(service.createOrder(actor, {
      idempotencyKey: 'idempotency-create',
      source: 'Habitacion', stayId: '00000000-0000-4000-8000-000000000002',
      items: [{ menuItemId: '00000000-0000-4000-8000-000000000003', quantity: 1 }],
      paymentMethod: 'Efectivo', estimatedMinutes: 15, comment: null,
    }, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('rejects foreign or unavailable menu references when editing an existing local order', async () => {
    const { service, tx } = setup([[], [{ id: 'order', propertyId: actor.propertyId, status: 'Pedido recibido', version: 1 }], []]);
    await expect(service.updateOrder(actor, 'order', {
      idempotencyKey: 'idempotency-update',
      expectedVersion: 1,
      source: 'Barra', stayId: null,
      items: [{ menuItemId: '00000000-0000-4000-8000-000000000004', quantity: 1 }],
      paymentMethod: 'Efectivo', estimatedMinutes: 15, comment: null,
    }, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
