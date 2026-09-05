import { ConflictException } from '@nestjs/common';
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
  const tx = { select: vi.fn(() => query(selections.shift() ?? [])), insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const database = {
    select: vi.fn(() => query(selections.shift() ?? [])),
    update: vi.fn(),
    transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)),
  };
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new RestaurantService(database as unknown as Database, {} as FolioService, audit), database, tx };
}

const manual = { id: 'manual', propertyId: actor.propertyId, status: 'active', isPublished: true, isAvailable: true, managementMode: 'manual', salePrice: '10.00' };
const imported = { id: 'imported', propertyId: actor.propertyId, status: 'active', isPublished: true, isAvailable: true, managementMode: 'imported', salePrice: '12.00' };
const hidden = { id: 'hidden', propertyId: actor.propertyId, status: 'active', isPublished: false, isAvailable: false, managementMode: 'imported', salePrice: null };
const variants = [
  { id: 'sellable', menuItemId: imported.id, status: 'active', isPublished: true, isAvailable: true, price: '12.00', position: 0 },
  { id: 'hidden-variant', menuItemId: imported.id, status: 'active', isPublished: false, isAvailable: false, price: '14.00', position: 1 },
  { id: 'unpriced', menuItemId: hidden.id, status: 'active', isPublished: false, isAvailable: false, price: null, position: 0 },
];

describe('Restaurant menu application boundary', () => {
  it('returns only sellable products and variants to ordinary ordering consumers', async () => {
    const { service } = setup([[manual, imported, hidden], [], variants]);

    const result = await service.listMenu(actor.propertyId);

    expect(result.map((item) => item.id)).toEqual(['manual', 'imported']);
    expect(result.find((item) => item.id === 'imported')?.variants.map((variant) => variant.id)).toEqual(['sellable']);
  });

  it('keeps hidden imported rows inspectable through the explicit management read', async () => {
    const { service } = setup([[manual, imported, hidden], [], variants]);

    const result = await service.listManagedMenu(actor.propertyId);

    expect(result.map((item) => item.id)).toEqual(['manual', 'imported', 'hidden']);
    expect(result.find((item) => item.id === 'hidden')?.variants.map((variant) => variant.id)).toEqual(['unpriced']);
    expect(result.find((item) => item.id === 'imported')?.variants.map((variant) => variant.id)).toEqual(['sellable', 'hidden-variant']);
  });

  it('rejects update and archive attempts against importer-owned products before writing', async () => {
    const update = setup([[imported]]);
    await expect(update.service.updateMenuItem(actor, imported.id, {
      name: 'Changed product', category: 'Comidas', salePrice: 20, preparationMinutes: 10, description: null, ingredients: [],
    }, {})).rejects.toBeInstanceOf(ConflictException);
    expect(update.tx.delete).not.toHaveBeenCalled();
    expect(update.tx.update).not.toHaveBeenCalled();

    const archive = setup([[imported]]);
    await expect(archive.service.archiveMenuItem(actor, imported.id, { reason: 'Manual override' })).rejects.toBeInstanceOf(ConflictException);
    expect(archive.database.update).not.toHaveBeenCalled();
  });
});
