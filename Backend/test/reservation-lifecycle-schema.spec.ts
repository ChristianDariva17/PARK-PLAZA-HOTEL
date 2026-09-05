import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0014_reservation_lifecycle.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../src/database/schema/reservations.schema.ts', import.meta.url), 'utf8');

describe('reservation lifecycle persistence contract', () => {
  it('keeps lifecycle metadata and UUID-keyed canonical command receipts aligned in migration and schema', () => {
    expect(migration).toContain('ADD COLUMN "status_changed_at"');
    expect(migration).toContain('ADD COLUMN "status_reason"');
    expect(migration).toContain('CREATE TABLE "reservation_commands"');
    expect(migration).toContain('UNIQUE("property_id", "idempotency_key")');
    expect(schema).toContain("statusChangedAt: timestamp('status_changed_at'");
    expect(schema).toContain("idempotencyKey: uuid('idempotency_key')");
    expect(schema).toContain('response: jsonb().$type<ReservationCommandReceipt>()');
  });
});
