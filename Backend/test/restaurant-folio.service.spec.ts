import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import type { FolioService } from '../src/folios/folio.service.js';
import { RestaurantService } from '../src/restaurant/restaurant.service.js';

const actor = { accountId: 'account', propertyId: 'property', email: 'restaurant@example.invalid', permissions: [], roleKey: 'restaurant', sessionId: 'session', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const context: RequestContext = { requestId: 'request' };
const delivered = { id: 'order', propertyId: actor.propertyId, stayId: 'stay', status: 'Listo', total: '12.50', inventoryStage: 'Consumido', accountingStage: 'Pendiente' };

function setup(selections: unknown[][]) {
  const updates: unknown[] = [];
  const tx = {
    select: vi.fn(() => query(selections.shift() ?? [])),
    update: vi.fn(() => ({
      set: vi.fn((value) => {
        updates.push(value);
        return {
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ ...delivered, ...value }]),
          })),
        };
      }),
    })),
  };
  const db = { transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)) } as unknown as Database;
  const folios = { postRestaurantCharge: vi.fn(), reverseRestaurantCharge: vi.fn() } as unknown as FolioService;
  return { service: new RestaurantService(db, folios, { emitToProperty: vi.fn(), emitToStay: vi.fn() } as any), folios, updates };
}

describe('Restaurant folio posting behavior', () => {
  it('posts one charge only for same-property Listo to Entregado and never advances linked Entregado to Pagado', async () => {
    const ready = setup([[delivered], [], [{ id: 'stay' }], [{ ...delivered, status: 'Entregado' }], [{ ...delivered, status: 'Entregado' }], []]);
    await ready.service.advanceOrder(actor, delivered.id, { expectedStatus: 'Listo' }, context);
    expect(ready.folios.postRestaurantCharge).toHaveBeenCalledWith(expect.anything(), actor, 'stay', 'order', '12.50', context);
    expect(ready.updates).toContainEqual(expect.objectContaining({ status: 'Entregado' }));
    await expect(ready.service.advanceOrder(actor, delivered.id, { expectedStatus: 'Entregado' }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(ready.folios.postRestaurantCharge).toHaveBeenCalledTimes(1);

    const terminal = setup([[{ ...delivered, status: 'Entregado' }]]);
    await expect(terminal.service.advanceOrder(actor, delivered.id, { expectedStatus: 'Entregado' }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(terminal.folios.postRestaurantCharge).not.toHaveBeenCalled();
  });

  it('distinguishes foreign orders from inactive linked stays and reverses an eligible cancellation once', async () => {
    const foreign = setup([[]]);
    await expect(foreign.service.advanceOrder(actor, delivered.id, { expectedStatus: 'Listo' }, context)).rejects.toThrow('Pedido no encontrado');
    expect(foreign.updates).toEqual([]);

    const unavailable = setup([[delivered], [], []]);
    await expect(unavailable.service.advanceOrder(actor, delivered.id, { expectedStatus: 'Listo' }, context)).rejects.toBeInstanceOf(ConflictException);
    expect(unavailable.updates).toEqual([]);

    const cancellation = setup([[{ ...delivered, status: 'Entregado' }], [{ ...delivered, status: 'Cancelado' }]]);
    await cancellation.service.cancelOrder(actor, delivered.id, { reason: 'Guest cancelled' }, context);
    expect(cancellation.folios.reverseRestaurantCharge).toHaveBeenCalledWith(expect.anything(), actor, 'stay', 'order', 'Guest cancelled', context);
    expect(cancellation.folios.reverseRestaurantCharge).toHaveBeenCalledTimes(1);
    expect(cancellation.updates).toContainEqual(expect.objectContaining({ status: 'Cancelado' }));
    await expect(cancellation.service.cancelOrder(actor, delivered.id, { reason: 'Retry' }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(cancellation.folios.reverseRestaurantCharge).toHaveBeenCalledTimes(1);

    const paid = setup([[{ ...delivered, status: 'Pagado' }]]);
    await expect(paid.service.cancelOrder(actor, delivered.id, { reason: 'Too late' }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(paid.folios.reverseRestaurantCharge).not.toHaveBeenCalled();
  });
});

function query(value: unknown) { const chain: any = {}; for (const method of ['from', 'where', 'limit', 'for']) chain[method] = vi.fn(() => chain); chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve); return chain; }
