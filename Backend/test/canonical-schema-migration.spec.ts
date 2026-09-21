import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0044_canonical_supplier_schema.sql', import.meta.url), 'utf8');
const operationsMigration = readFileSync(new URL('../drizzle/0052_phase_3_operations.sql', import.meta.url), 'utf8');
const realtimeOutboxMigration = readFileSync(new URL('../drizzle/0053_phase_1_realtime_outbox.sql', import.meta.url), 'utf8');
const purchaseOrderSequenceMigration = readFileSync(new URL('../drizzle/0054_purchase_order_sequences.sql', import.meta.url), 'utf8');
const propertyScopedRelationshipsMigration = readFileSync(new URL('../drizzle/0057_property_scoped_outbox_relationships.sql', import.meta.url), 'utf8');
const reliableOutboxMigration = readFileSync(new URL('../drizzle/0058_reliable_outbox.sql', import.meta.url), 'utf8');
const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
const drizzleConfig = readFileSync(new URL('../drizzle.config.ts', import.meta.url), 'utf8');

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

  it('keeps the runtime and CLI migration journal in the same schema', () => {
    expect(journal.entries).toContainEqual({ idx: 52, version: '7', when: 1789403000000, tag: '0052_phase_3_operations', breakpoints: true });
    expect(journal.entries).toContainEqual({ idx: 53, version: '7', when: 1789490000000, tag: '0053_phase_1_realtime_outbox', breakpoints: true });
    expect(journal.entries).toContainEqual({ idx: 54, version: '7', when: 1789493600000, tag: '0054_purchase_order_sequences', breakpoints: true });
    expect(operationsMigration).toContain("'0052_phase_3_operations'");
    expect(realtimeOutboxMigration).toContain('"stay_id"');
    expect(realtimeOutboxMigration).toContain('outbox_events_stay_id_stays_id_fk');
    expect(realtimeOutboxMigration).toContain("'0053_phase_1_realtime_outbox'");
    expect(purchaseOrderSequenceMigration).toContain('purchase_order_sequences');
    expect(purchaseOrderSequenceMigration).toContain("'0054_purchase_order_sequences'");
    expect(journal.entries).toContainEqual({ idx: 57, version: '7', when: 1789532346197, tag: '0057_property_scoped_outbox_relationships', breakpoints: true });
    expect(propertyScopedRelationshipsMigration).toContain('request_id varchar(128)');
    expect(propertyScopedRelationshipsMigration).toContain('outbox_events_stay_property_fkey');
    expect(propertyScopedRelationshipsMigration).toContain('customer_amenity_commands_reservation_property_fkey');
    expect(propertyScopedRelationshipsMigration).toContain('purchase_orders_supplier_property_fkey');
    expect(journal.entries).toContainEqual({ idx: 58, version: '7', when: 1789536000000, tag: '0058_reliable_outbox', breakpoints: true });
    expect(reliableOutboxMigration).toContain('outbox_events_status_check');
    expect(reliableOutboxMigration).toContain('outbox_events_dead_letter_idx');
    expect(reliableOutboxMigration).toContain("'0058_reliable_outbox'");
    expect(drizzleConfig).toContain("schema: 'drizzle'");
  });
});
