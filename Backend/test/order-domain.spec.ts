import { describe, expect, it } from 'vitest';
import { determineStation, planOrderAdvance, planOrderPricing } from '../src/restaurant/order-domain.js';

describe('order domain rules', () => {
  it('determines the preparation station from the menu category', () => {
    expect(determineStation('Bebidas')).toBe('bar');
    expect(determineStation('Cafe y frappe')).toBe('coffee');
    expect(determineStation('Desayuno')).toBe('kitchen');
    expect(determineStation()).toBe('kitchen');
  });

  it('calculates deterministic order lines and total without persistence', () => {
    expect(planOrderPricing(
      [
        { menuItemId: 'coffee', quantity: 2 },
        { menuItemId: 'cake', quantity: 1, station: 'bar', notes: 'Sin hielo' },
      ],
      [
        { id: 'cake', name: 'Pastel', category: 'Postres', salePrice: '4.50' },
        { id: 'coffee', name: 'Cafe', category: 'Cafe', salePrice: '3.25' },
      ],
    )).toEqual({
      lines: [
        {
          menuItemId: 'coffee',
          menuItemName: 'Cafe',
          quantity: 2,
          unitPrice: '3.25',
          subtotal: '6.50',
          station: 'coffee',
          status: 'recibido',
          notes: null,
        },
        {
          menuItemId: 'cake',
          menuItemName: 'Pastel',
          quantity: 1,
          unitPrice: '4.50',
          subtotal: '4.50',
          station: 'bar',
          status: 'recibido',
          notes: 'Sin hielo',
        },
      ],
      total: '11.00',
    });
  });

  it('plans only valid order advances and preserves terminal rules', () => {
    expect(planOrderAdvance({ currentStatus: 'Confirmado', expectedStatus: 'Confirmado' })).toEqual({
      ok: true,
      nextStatus: 'En preparacion',
    });
    expect(planOrderAdvance({ currentStatus: 'Confirmado', expectedStatus: 'Pedido recibido' })).toEqual({
      ok: false,
      failure: { kind: 'stale', expectedStatus: 'Pedido recibido', currentStatus: 'Confirmado' },
    });
    expect(planOrderAdvance({ currentStatus: 'Pagado', expectedStatus: 'Pagado' })).toEqual({
      ok: false,
      failure: { kind: 'cannot_advance', currentStatus: 'Pagado' },
    });
    expect(planOrderAdvance({ currentStatus: 'Entregado', expectedStatus: 'Entregado', stayId: 'stay-1' })).toEqual({
      ok: false,
      failure: { kind: 'financially_terminal', currentStatus: 'Entregado' },
    });
  });
});
