import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import type { FolioService } from '../src/folios/folio.service.js';
import { RestaurantService } from '../src/restaurant/restaurant.service.js';

const customer = { customerAccountId: 'customer', propertyId: 'property', sessionId: 'session', email: 'guest@example.invalid', displayName: null, photoUrl: null };
const stayId = '550e8400-e29b-41d4-a716-446655440000';
const orderId = '550e8400-e29b-41d4-a716-446655440001';
const key = '550e8400-e29b-41d4-a716-446655440002';
const dto = { stayId, deliveryMode: 'Room' as const, paymentMode: 'room_charge' as const, items: [{ menuItemId: '550e8400-e29b-41d4-a716-446655440003', quantity: 2 }], note: '' };

function query(value: unknown) {
  const chain: any = {};
  for (const method of ['from', 'innerJoin', 'where', 'limit', 'for']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

function transactionWith(selections: unknown[][]) {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  const tx = {
    select: vi.fn(() => query(selections.shift() ?? [])),
    update: vi.fn(() => ({ set: vi.fn((value) => {
      updates.push(value);
      return { where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: orderId, status: 'Cancelado', ...value }]) })) };
    }) })),
    insert: vi.fn(() => ({ values: vi.fn((value) => { inserts.push(value); return Promise.resolve(); }) })),
  };
  const db = { transaction: vi.fn((run: (value: typeof tx) => unknown) => run(tx)) } as unknown as Database;
  return { db, inserts, updates, tx };
}

function createOrderHarness(selections: unknown[][]) {
  const inserts: unknown[] = [];
  const tx = {
    select: vi.fn(() => query(selections.shift() ?? [])),
    insert: vi.fn(() => ({ values: vi.fn((value) => {
      inserts.push(value);
      return { returning: vi.fn().mockResolvedValue([{ id: orderId, source: 'Portal Huésped', status: 'Pedido recibido', stayId, total: '25.00', estimatedMinutes: 20, comment: '', deliveryMode: 'Room', paymentMode: 'room_charge', createdAt: new Date('2026-01-01T00:00:00.000Z') }]) };
    }) })),
  };
  return { db: { transaction: vi.fn((run: (value: typeof tx) => unknown) => run(tx)) } as unknown as Database, inserts };
}

describe('customer checkout settlement behavior', () => {
  it('rejects unsupported payment before opening a transaction', async () => {
    const db = { transaction: vi.fn() } as unknown as Database;
    const service = new RestaurantService(db, {} as FolioService, {} as any);

    await expect(service.createCustomerOrder(customer, { ...dto, paymentMode: 'online' }, key)).rejects.toMatchObject({
      status: 422,
      response: { code: 'PAYMENT_MODE_UNSUPPORTED' },
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('uses current sellable menu prices rather than caller-controlled values', async () => {
    const service = new RestaurantService({} as Database, {} as FolioService, {} as any);
    const firstItem = dto.items[0];
    if (!firstItem) throw new Error('Checkout fixture requires one item');
    const tx = { select: vi.fn()
      .mockReturnValueOnce(query([{ id: firstItem.menuItemId, name: 'Tea', status: 'active', isPublished: true, isAvailable: true, salePrice: '12.50' }]))
      .mockReturnValueOnce(query([])) };

    const lines = await (service as any).buildOrderLines(tx, customer.propertyId, {
      ...dto,
      items: [{ ...firstItem, price: '0.01' }],
    });
    expect(lines).toMatchObject([{ unitPrice: '12.50', subtotal: '25.00', quantity: 2 }]);
  });

  it('creates an order only after the customer has an authorized active stay', async () => {
    const harness = createOrderHarness([[], [{ id: stayId }], [{ id: dto.items[0]!.menuItemId, name: 'Tea', status: 'active', isPublished: true, isAvailable: true, salePrice: '12.50' }], []]);
    const service = new RestaurantService(harness.db, {} as FolioService, {} as any);

    await expect(service.createCustomerOrder(customer, dto, key)).resolves.toMatchObject({ code: 'ORDER_CREATED', order: { stayId } });
    expect(harness.inserts).toEqual(expect.arrayContaining([
      expect.objectContaining({ stayId, checkoutClassification: 'customer_checkout', paymentMode: 'room_charge' }),
      expect.arrayContaining([expect.objectContaining({ orderId, propertyId: customer.propertyId, menuItemId: dto.items[0]!.menuItemId })]),
      expect.objectContaining({ orderId, customerAccountId: customer.customerAccountId, propertyId: customer.propertyId }),
      expect.objectContaining({ orderId, idempotencyKey: key, operation: 'create', responseStatus: '201' }),
    ]));
  });

  it('rejects a reservation-only or otherwise unauthorized stay without mutation', async () => {
    const harness = createOrderHarness([[], []]);
    const service = new RestaurantService(harness.db, {} as FolioService, {} as any);

    await expect(service.createCustomerOrder(customer, dto, key)).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACTIVE_STAY_UNAUTHORIZED' },
    });
    expect(harness.inserts).toEqual([]);
  });

  it('normalizes item ordering into one canonical idempotency fingerprint', () => {
    const service = new RestaurantService({} as Database, {} as FolioService, {} as any);
    const first = [{ menuItemId: 'a', quantity: 1 }, { menuItemId: 'b', variantId: 'v', quantity: 2 }];
    const second = [...first].reverse();
    const canonical = (items: any[]) => (service as any).fingerprint({ customer: customer.customerAccountId, property: customer.propertyId, ...dto, items: (service as any).normalizedItems(items) });

    expect(canonical(first)).toBe(canonical(second));
  });

  it('rejects a changed semantic payload for an existing command key', async () => {
    const harness = transactionWith([[{ fingerprint: 'stored-fingerprint', response: { status: 201, body: {} } }]]);
    const service = new RestaurantService(harness.db, {} as FolioService, {} as any);

    await expect((service as any).findReceipt(harness.tx, customer, 'create', key, 'changed-fingerprint')).rejects.toMatchObject({
      status: 409,
      response: { code: 'CUSTOMER_COMMAND_CONFLICT' },
    });
    expect(harness.updates).toEqual([]);
    expect(harness.inserts).toEqual([]);
  });

  it('replays a matching cancellation receipt without another order mutation', async () => {
    const service = new RestaurantService({} as Database, {} as FolioService, {} as any);
    const fingerprint = (service as any).fingerprint({ customer: customer.customerAccountId, property: customer.propertyId, command: 'cancel', orderId, reasonCode: 'changed_mind' });
    const replay = { version: 1, outcome: 'accepted', code: 'ORDER_CANCELLED', order: { id: orderId, status: 'Cancelado' } };
    const harness = transactionWith([[{ fingerprint, response: { status: 200, body: replay } }]]);
    const replayService = new RestaurantService(harness.db, {} as FolioService, {} as any);

    await expect(replayService.cancelCustomerOrder(customer, orderId, { reasonCode: 'changed_mind' }, key)).resolves.toEqual(replay);
    expect(harness.updates).toEqual([]);
    expect(harness.inserts).toEqual([]);
  });

  it('rejects an unowned cancellation before any mutation', async () => {
    const harness = transactionWith([[], []]);
    const service = new RestaurantService(harness.db, {} as FolioService, {} as any);

    await expect(service.cancelCustomerOrder(customer, orderId, { reasonCode: 'changed_mind' }, key)).rejects.toMatchObject({
      status: 404,
      response: { code: 'ORDER_NOT_FOUND' },
    });
    expect(harness.updates).toEqual([]);
    expect(harness.inserts).toEqual([]);
  });

  it('rejects post-delivery cancellation without a folio reversal or receipt', async () => {
    const deliveredOrder = { id: orderId, propertyId: customer.propertyId, stayId, status: 'Entregado' };
    const harness = transactionWith([[], [{ orderId }], [deliveredOrder], [{ id: stayId }]]);
    const folios = { postRestaurantCharge: vi.fn(), reverseRestaurantCharge: vi.fn() } as unknown as FolioService;
    const service = new RestaurantService(harness.db, folios, {} as any);

    await expect(service.cancelCustomerOrder(customer, orderId, { reasonCode: 'other' }, key)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CUSTOMER_CANCELLATION_INELIGIBLE' },
    });
    expect(harness.updates).toEqual([]);
    expect(harness.inserts).toEqual([]);
    expect((folios as any).reverseRestaurantCharge).not.toHaveBeenCalled();
  });

  it('records a typed pre-delivery cancellation without touching the folio boundary', async () => {
    const pendingOrder = { id: orderId, propertyId: customer.propertyId, stayId, status: 'Pedido recibido' };
    const harness = transactionWith([[], [{ orderId }], [pendingOrder], [{ id: stayId }]]);
    const folios = { postRestaurantCharge: vi.fn(), reverseRestaurantCharge: vi.fn() } as unknown as FolioService;
    const service = new RestaurantService(harness.db, folios, {} as any);

    await expect(service.cancelCustomerOrder(customer, orderId, { reasonCode: 'duplicate_order' }, key)).resolves.toMatchObject({
      code: 'ORDER_CANCELLED',
      order: { status: 'Cancelado', cancelReason: 'duplicate_order' },
    });
    expect(harness.updates).toContainEqual(expect.objectContaining({ status: 'Cancelado', cancelReason: 'duplicate_order' }));
    expect(harness.inserts).toContainEqual(expect.objectContaining({ operation: 'cancel', responseStatus: '200' }));
    expect((folios as any).postRestaurantCharge).not.toHaveBeenCalled();
    expect((folios as any).reverseRestaurantCharge).not.toHaveBeenCalled();
  });
});

