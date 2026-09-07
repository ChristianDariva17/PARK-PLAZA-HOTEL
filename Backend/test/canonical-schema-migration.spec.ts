import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0044_canonical_supplier_schema.sql', import.meta.url), 'utf8');
const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };

describe('canonical supplier schema migration', () => {
  it('keeps idempotent supplier DDL in the versioned migration history', () => {
    expect(journal.entries).toContainEqual({ idx: 44, version: '7', when: 1788316200000, tag: '0044_canonical_supplier_schema', breakpoints: true });
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "rating" integer DEFAULT 5');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "rating_notes" text');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "purchase_orders"');
    expect(migration).toContain('purchase_orders_property_id_properties_id_fk');
    expect(migration).toContain('purchase_orders_supplier_id_suppliers_id_fk');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchase_orders_property_isolation"');
  });

  it('does not expose manual product-DDL commands', () => {
    expect(packageJson.scripts).not.toHaveProperty('db:init-suppliers');
    expect(packageJson.scripts).not.toHaveProperty('db:init-contracts');
  });
});
