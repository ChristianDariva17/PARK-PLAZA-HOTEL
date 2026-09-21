import { describe, expect, it } from 'vitest';
import {
  calculateInventoryRequirements,
  convertIngredientToInventoryUnit,
  planInventoryConsumption,
  planInventoryRelease,
  planInventoryReservation,
} from '../src/restaurant/inventory-domain.js';

describe('inventory domain rules', () => {
  it('converts supported recipe and stock units without infrastructure dependencies', () => {
    expect(convertIngredientToInventoryUnit(33.814, 'oz', 'l')).toBeCloseTo(1, 8);
    expect(convertIngredientToInventoryUnit(1_000, 'g', 'kg')).toBe(1);
    expect(convertIngredientToInventoryUnit(2, 'und', 'und')).toBe(2);
    expect(convertIngredientToInventoryUnit(2, 'portion', 'und')).toBe(2);
  });

  it('aggregates repeated ingredients and returns deterministic inventory order', () => {
    const requirements = calculateInventoryRequirements(
      [
        { menuItemId: 'menu-a', quantity: 2 },
        { menuItemId: 'menu-b', quantity: 3 },
      ],
      [
        { menuItemId: 'menu-a', inventoryItemId: 'inventory-z', quantity: '2', unit: 'und' },
        { menuItemId: 'menu-b', inventoryItemId: 'inventory-z', quantity: '2', unit: 'und' },
        { menuItemId: 'menu-b', inventoryItemId: 'inventory-a', quantity: '1', unit: 'und' },
        { menuItemId: 'menu-b', inventoryItemId: 'missing', quantity: '99', unit: 'und' },
      ],
      [
        { id: 'inventory-z', unit: 'und' },
        { id: 'inventory-a', unit: 'und' },
      ],
    );

    expect(requirements).toEqual([
      { inventoryItemId: 'inventory-a', quantity: 3 },
      { inventoryItemId: 'inventory-z', quantity: 10 },
    ]);
  });

  it('plans stock transitions without performing persistence', () => {
    const item = { id: 'inventory', name: 'Tomate', unit: 'und', stock: '10', reserved: '2' };

    expect(planInventoryReservation(item, 3, 'order')).toEqual({
      ok: true,
      plan: {
        update: { reserved: '5.0000' },
        ledger: { type: 'Reserva', quantity: '-3.0000', note: 'Reserva por comanda order' },
      },
    });
    expect(planInventoryReservation(item, 9, 'order')).toEqual({
      ok: false,
      failure: { kind: 'insufficient_stock', itemName: 'Tomate', available: 8, required: 9, unit: 'und' },
    });
    expect(planInventoryConsumption(item, 3, 'order')).toEqual({
      update: { stock: '7.0000', reserved: '0.0000' },
      ledger: { type: 'Consumo', quantity: '-3.0000', note: 'Consumo por comanda order' },
    });
    expect(planInventoryRelease(item, 3, 'order')).toEqual({
      update: { reserved: '0.0000' },
      ledger: { type: 'Devolucion', quantity: '3.0000', note: 'Devolucion por cancelacion de pedido order' },
    });
  });
});
