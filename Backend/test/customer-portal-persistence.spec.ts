import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../drizzle/0015_customer_portal.sql', import.meta.url), 'utf8');
const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
const schema = readFileSync(new URL('../src/database/schema/customer.schema.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/reservations/reservations.service.ts', import.meta.url), 'utf8');

describe('customer portal persistence contract', () => {
  it('registers lifecycle and customer migrations in executable order', () => {
    const lifecyclePosition = journal.entries.findIndex((entry) => entry.tag === '0014_reservation_lifecycle');
    const customerPosition = journal.entries.findIndex((entry) => entry.tag === '0015_customer_portal');

    expect(journal.entries.filter((entry) => entry.tag === '0014_reservation_lifecycle')).toHaveLength(1);
    expect(journal.entries.filter((entry) => entry.tag === '0015_customer_portal')).toHaveLength(1);
    expect(customerPosition).toBe(lifecyclePosition + 1);
    expect(journal.entries.slice(lifecyclePosition, customerPosition + 1)).toEqual([
      expect.objectContaining({ idx: 14, tag: '0014_reservation_lifecycle' }),
      expect.objectContaining({ idx: 15, tag: '0015_customer_portal' }),
    ]);
  });

  it('keeps customer guest bindings and scoped booking receipts aligned', () => {
    expect(migration).toContain('CREATE TABLE "customer_guest_identities"');
    expect(migration).toContain('CREATE TABLE "customer_reservation_commands"');
    expect(migration).toContain('UNIQUE("customer_account_id", "idempotency_key")');
    expect(schema).toContain("customerGuestIdentities = pgTable('customer_guest_identities'");
    expect(schema).toContain("customerReservationCommands = pgTable('customer_reservation_commands'");
    expect(schema).toContain("idempotencyKey: uuid('idempotency_key')");
  });

  it('checks receipts before identity and rejects unbound document collisions generically', () => {
    expect(service.indexOf('const receiptRows')).toBeLessThan(service.indexOf('const bindingRows'));
    expect(service).toContain("if (collisionRows[0]) throw new ConflictException('Unable to verify customer identity')");
    expect(service).not.toContain("existingGuestRows");
    expect(service).toContain('tx.insert(customerGuestIdentities)');
    expect(service).toContain('tx.insert(customerReservationCommands)');
  });
});
