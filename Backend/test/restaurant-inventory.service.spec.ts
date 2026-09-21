import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { inventoryItems, orderItems } from '../src/database/schema/index.js';
import type { FolioService } from '../src/folios/folio.service.js';
import { RestaurantService } from '../src/restaurant/restaurant.service.js';

const actor = {
  accountId: 'account',
  propertyId: 'property',
  email: 'restaurant@example.invalid',
  permissions: [],
  roleKey: 'restaurant',
  sessionId: 'session',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

type InventoryOperations = {
  reserveOrderInventory: (tx: unknown, actor: AuthenticatedAccount, orderId: string, lines: Array<typeof orderItems.$inferSelect>) => Promise<void>;
  consumeOrderInventory: (tx: unknown, actor: AuthenticatedAccount, orderId: string, lines: Array<typeof orderItems.$inferSelect>) => Promise<void>;
};

function query(value: unknown) {
  const chain: any = {};
  for (const method of ['from', 'where', 'limit', 'for', 'orderBy']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

function setup(selections: unknown[][]) {
  const queries: any[] = [];
  const updates: unknown[] = [];
  const ledgerValues: unknown[] = [];
  const tx = {
    select: vi.fn(() => {
      const chain = query(selections.shift() ?? []);
      queries.push(chain);
      return chain;
    }),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updates.push(values);
        return {
          where: vi.fn(() => ({
            then: (resolve: (result: unknown) => unknown) => Promise.resolve([]).then(resolve),
            returning: vi.fn().mockResolvedValue([{ id: 'order', status: 'Cancelado' }]),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        ledgerValues.push(values);
        return Promise.resolve([]);
      }),
    })),
  };
  const database = {
    transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)),
  };
  const service = new RestaurantService(
    database as unknown as Database,
    {} as FolioService,
    { enqueue: vi.fn().mockResolvedValue(undefined) } as any,
  );
  return { service, tx, queries, updates, ledgerValues };
}

function operations(service: RestaurantService) {
  return service as unknown as InventoryOperations;
}

function lines() {
  return [
    { menuItemId: 'menu-a', quantity: 2 },
    { menuItemId: 'menu-b', quantity: 3 },
  ] as unknown as Array<typeof orderItems.$inferSelect>;
}

function ingredient(menuItemId: string, quantity: string, inventoryItemId = 'inventory') {
  return { propertyId: actor.propertyId, menuItemId, inventoryItemId, quantity, unit: 'und' };
}

function inventory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inventory',
    propertyId: actor.propertyId,
    name: 'Tomate',
    unit: 'und',
    stock: '20',
    reserved: '0',
    ...overrides,
  };
}

describe('Restaurant inventory mutations', () => {
  it('loads ingredients and inventory in batches and aggregates repeated inventory requirements', async () => {
    const setupResult = setup([
      [ingredient('menu-a', '2'), ingredient('menu-b', '2')],
      [inventory()],
    ]);

    await operations(setupResult.service).reserveOrderInventory(setupResult.tx, actor, 'order', lines());

    expect(setupResult.tx.select).toHaveBeenCalledTimes(2);
    expect(setupResult.queries[1].orderBy).toHaveBeenCalledWith(inventoryItems.id);
    expect(setupResult.queries[1].for).toHaveBeenCalledWith('update', { of: inventoryItems });
    expect(setupResult.tx.update).toHaveBeenCalledTimes(1);
    expect(setupResult.updates).toEqual([{ reserved: '10.0000' }]);
    expect(setupResult.ledgerValues).toEqual([[
      {
        propertyId: actor.propertyId,
        inventoryItemId: 'inventory',
        type: 'Reserva',
        quantity: '-10.0000',
        referenceId: 'order',
        note: 'Reserva por comanda order',
        responsible: actor.email,
      },
    ]]);
  });

  it('validates every aggregate before writing when stock is insufficient', async () => {
    const setupResult = setup([
      [ingredient('menu-a', '3')],
      [inventory({ stock: '5' })],
    ]);

    await expect(
      operations(setupResult.service).reserveOrderInventory(setupResult.tx, actor, 'order', [
        { menuItemId: 'menu-a', quantity: 2 },
      ] as unknown as Array<typeof orderItems.$inferSelect>),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(setupResult.tx.update).not.toHaveBeenCalled();
    expect(setupResult.tx.insert).not.toHaveBeenCalled();
  });

  it('consumes each inventory item once and clears its reservation without extra ingredient reads', async () => {
    const setupResult = setup([
      [ingredient('menu-a', '3')],
      [inventory({ stock: '10', reserved: '6' })],
    ]);

    await operations(setupResult.service).consumeOrderInventory(setupResult.tx, actor, 'order', [
      { menuItemId: 'menu-a', quantity: 2 },
    ] as unknown as Array<typeof orderItems.$inferSelect>);

    expect(setupResult.tx.select).toHaveBeenCalledTimes(2);
    expect(setupResult.tx.update).toHaveBeenCalledTimes(1);
    expect(setupResult.updates).toEqual([{ stock: '4.0000', reserved: '0.0000' }]);
    expect(setupResult.ledgerValues[0]).toEqual([expect.objectContaining({ type: 'Consumo', quantity: '-6.0000' })]);
  });

  it('returns reserved inventory in a batch when cancelling a reserved order', async () => {
    const order = {
      id: 'order',
      propertyId: actor.propertyId,
      status: 'En preparacion',
      inventoryStage: 'Reservado',
    };
    const setupResult = setup([
      [order],
      [{ menuItemId: 'menu-a', quantity: 2 }],
      [ingredient('menu-a', '3')],
      [inventory({ reserved: '6' })],
    ]);

    await setupResult.service.cancelOrder(actor, 'order', { reason: 'Guest cancelled' }, {});

    expect(setupResult.tx.select).toHaveBeenCalledTimes(4);
    expect(setupResult.queries[0].for).toHaveBeenCalledWith('update', expect.anything());
    expect(setupResult.tx.update).toHaveBeenCalledTimes(2);
    expect(setupResult.updates).toContainEqual({ reserved: '0.0000' });
    expect(setupResult.ledgerValues[0]).toEqual([expect.objectContaining({ type: 'Devolucion', quantity: '6.0000' })]);
  });
});
