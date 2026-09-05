import { describe, expect, it } from 'vitest';
import { adaptMenuItem, adaptOrdersList, getItemDisplayPrice } from './restaurantModel.js';

describe('adaptOrdersList', () => {
  it('maps the confirmed minimal order payload without unrelated fields', () => {
    const [order] = adaptOrdersList([{
      id: 'B04502DD',
      total: '42.50',
      items: [{
        id: 'line-1', menuItemId: 'menu-1', menuItemName: 'Breakfast', quantity: 2, unitPrice: '21.25', subtotal: '42.50',
      }],
    }]);

    expect(order).toMatchObject({
      id: 'B04502DD', stayId: null, total: 42.5, comment: '', cancelReason: null,
      items: [{
        id: 'line-1', menuItemId: 'menu-1', variantId: null, name: 'Breakfast', variantName: null, quantity: 2, unitPrice: 21.25, subtotal: 42.5,
      }],
    });
  });
});

describe('adaptMenuItem', () => {
  it('maps a manual item with no variants', () => {
    const item = adaptMenuItem({
      id: 'item-1', propertyId: 'prop-1', name: 'Sandwich', category: 'Comidas',
      salePrice: '15.00', currency: 'PEN', description: 'Con tomate', preparationMinutes: 8,
      status: 'active', isPublished: true, isAvailable: true, managementMode: 'manual',
      ingredients: [], variants: [], position: 3,
    });

    expect(item).toMatchObject({
      id: 'item-1', name: 'Sandwich', salePrice: 15, currency: 'PEN',
      isPublished: true, isAvailable: true, isManaged: false, position: 3,
      variants: [],
    });
  });

  it('maps an imported item with variants and preserves all variant fields', () => {
    const item = adaptMenuItem({
      id: 'item-2', propertyId: 'prop-1', name: 'Frappe Sublime', category: 'Bebidas',
      salePrice: '14.00', currency: 'PEN', status: 'active',
      isPublished: true, isAvailable: true, managementMode: 'imported', position: 0,
      ingredients: [], variants: [
        { id: 'v1', name: 'Pequeño', price: '12.00', currency: 'PEN', position: 0, status: 'active', isPublished: true, isAvailable: true },
        { id: 'v2', name: 'Mediano', price: '14.00', currency: 'PEN', position: 1, status: 'active', isPublished: true, isAvailable: true },
        { id: 'v3', name: 'Grande', price: null, currency: 'PEN', position: 2, status: 'active', isPublished: false, isAvailable: false },
      ],
    });

    expect(item.isManaged).toBe(true);
    expect(item.variants).toHaveLength(3);
    expect(item.variants[0]).toMatchObject({ id: 'v1', name: 'Pequeño', price: 12, position: 0, isPublished: true });
    expect(item.variants[2]).toMatchObject({ id: 'v3', price: null, isPublished: false });
  });

  it('treats null salePrice as null (not NaN)', () => {
    const item = adaptMenuItem({
      id: 'item-3', name: 'Sin precio', category: 'Otro',
      salePrice: null, status: 'active', managementMode: 'imported', variants: [],
    });
    expect(item.salePrice).toBeNull();
  });
});

describe('getItemDisplayPrice', () => {
  it('returns salePrice when there are no variants', () => {
    const item = adaptMenuItem({ id: 'i', name: 'X', category: 'Otro', salePrice: '10.00', status: 'active', managementMode: 'manual', variants: [] });
    expect(getItemDisplayPrice(item)).toBe(10);
  });

  it('returns the first active variant price when variants exist', () => {
    const item = adaptMenuItem({
      id: 'i', name: 'X', category: 'Bebidas', salePrice: null, status: 'active', managementMode: 'imported',
      variants: [
        { id: 'v1', name: 'Pequeño', price: '12.00', currency: 'PEN', position: 0, status: 'active', isPublished: true, isAvailable: true },
        { id: 'v2', name: 'Mediano', price: '15.00', currency: 'PEN', position: 1, status: 'active', isPublished: true, isAvailable: true },
      ],
    });
    expect(getItemDisplayPrice(item)).toBe(12);
  });

  it('returns null when all variants are unpublished or have null price', () => {
    const item = adaptMenuItem({
      id: 'i', name: 'X', category: 'Otro', salePrice: null, status: 'active', managementMode: 'imported',
      variants: [
        { id: 'v1', name: 'Estándar', price: null, currency: 'PEN', position: 0, status: 'active', isPublished: false, isAvailable: false },
      ],
    });
    expect(getItemDisplayPrice(item)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getItemDisplayPrice(null)).toBeNull();
  });
});
