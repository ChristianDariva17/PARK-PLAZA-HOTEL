import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0016_property_scoped_menu_import.sql', import.meta.url), 'utf8');
const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
const schema = readFileSync(new URL('../src/database/schema/restaurant.schema.ts', import.meta.url), 'utf8');
const importer = readFileSync(new URL('../src/restaurant/menu-import.service.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/restaurant/restaurant.controller.ts', import.meta.url), 'utf8');

describe('property-scoped menu import persistence', () => {
  it('registers the additive migration after the customer portal boundary', () => {
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 15, tag: '0015_customer_portal' }),
        expect.objectContaining({ idx: 16, tag: '0016_property_scoped_menu_import' }),
      ])
    );
  });

  it('keeps property-safe menu, variant, ingredient, stay, and order constraints aligned', () => {
    for (const constraint of [
      'menu_item_variants_item_property_fkey',
      'menu_ingredients_inventory_property_fkey',
      'inventory_ledger_item_property_fkey',
      'orders_stay_property_fkey',
      'order_items_order_property_fkey',
      'order_items_variant_property_item_fkey',
    ]) {
      expect(migration).toContain(`CONSTRAINT "${constraint}"`);
      expect(schema).toContain(`name: '${constraint}'`);
    }
  });

  it('records auditable runs, serializes apply operations, and only updates imported records', () => {
    expect(schema).toContain("menuImportRuns = pgTable('menu_import_runs'");
    expect(importer).toContain("if (mode === 'apply') await acquirePropertyTransactionLock");
    expect(importer).toContain("eq(menuItems.managementMode, 'imported')");
    expect(importer).toContain("eq(menuItemVariants.managementMode, 'imported')");
    expect(importer).toContain("eq(menuCategories.managementMode, 'imported')");
    expect(importer).toContain("status: 'failed', errorMessage: 'Menu import failed'");
  });

  it('exposes hidden menu records only through the explicit importer-management permission boundary', () => {
    expect(controller).toContain("@Get('internal/menu')");
    expect(controller).toContain("@RequirePermissions('kitchen.create', 'kitchen.update', 'kitchen.archive')");
    expect(controller).toContain('return this.restaurant.listManagedMenu(actor.propertyId)');
  });
});
