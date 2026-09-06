import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { FolioService } from '../src/folios/folio.service.js';
import { ReceivablesService } from '../src/receivables/receivables.service.js';
import { databaseUrlFromEnv, validateEnv } from '../src/config/environment.js';
import * as schema from '../src/database/schema/index.js';

const env = validateEnv({ ...process.env, DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '5433' });
const pool = new Pool({ connectionString: databaseUrlFromEnv(env), max: 1 });
afterAll(() => pool.end());

interface ReservationFixture {
  propertyId: string;
  categoryId: string;
  roomId: string;
  primaryGuestId: string;
  secondaryGuestId: string;
  propertyCode: string;
  roomNumber: string;
}

async function inRolledBackTransaction(run: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await run(client);
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

async function captureViolation(client: PoolClient, operation: () => Promise<unknown>): Promise<unknown> {
  await client.query('SAVEPOINT expected_violation');
  let caught = false;
  let violation: unknown;
  try {
    await operation();
  } catch (error: unknown) {
    caught = true;
    violation = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_violation');
    await client.query('RELEASE SAVEPOINT expected_violation');
  }
  if (!caught) throw new Error('Expected PostgreSQL to reject the operation');
  return violation;
}

function postgresErrorField(error: unknown, field: string): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = Reflect.get(error, field);
  return typeof value === 'string' ? value : undefined;
}

function expectPostgresViolation(error: unknown, code: string, constraint: string): void {
  expect(postgresErrorField(error, 'code')).toBe(code);
  expect(postgresErrorField(error, 'constraint')).toBe(constraint);
}

function uniqueHex(): string {
  return randomUUID().replaceAll('-', '');
}

function randomTokenHash(prefix: 'a' | 'b'): string {
  const random = `${uniqueHex()}${uniqueHex()}`;
  return `${prefix}${random.slice(1)}`;
}

async function insertReservationDependencies(client: PoolClient, fixture: ReservationFixture): Promise<void> {
  await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3)', [fixture.propertyId, fixture.propertyCode, 'Invariant Test Property']);
  await client.query('INSERT INTO room_categories (id, property_id, code, name, capacity, base_nightly_rate) VALUES ($1, $2, $3, $4, $5, $6)', [fixture.categoryId, fixture.propertyId, 'TEST', 'Invariant Test Category', 2, '100.00']);
  await client.query('INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5)', [fixture.roomId, fixture.propertyId, fixture.categoryId, fixture.roomNumber, 1]);
  await client.query('INSERT INTO guests (id, property_id, first_name, last_name) VALUES ($1, $2, $3, $4), ($5, $2, $6, $7)', [fixture.primaryGuestId, fixture.propertyId, 'Primary', 'Invariant', fixture.secondaryGuestId, 'Secondary', 'Invariant']);
}

describe('PostgreSQL readiness', () => {
  it('has the migrated schema and overlap constraint', async () => {
    const result = await pool.query<{ schema_ready: boolean; constraint_ready: boolean; guest_scope_ready: boolean; security_ready: boolean; audit_guard_ready: boolean; session_guard_ready: boolean; system_roles_ready: boolean; folio_ready: boolean; cleaning_stay_ready: boolean }>(`select
      to_regclass('public.reservations') is not null as schema_ready,
      exists (select 1 from pg_constraint where conname = 'reservations_no_active_overlap') as constraint_ready,
      exists (select 1 from pg_constraint where conname = 'identity_documents_guest_property_fkey' and convalidated and confdeltype = 'c')
        and exists (select 1 from pg_constraint where conname = 'identity_documents_property_document_unique')
        and exists (select 1 from pg_indexes where indexname = 'identity_documents_one_primary_idx')
        and exists (select 1 from pg_constraint where conname = 'guests_id_property_id_unique')
        and exists (select 1 from pg_constraint where conname = 'reservations_id_property_id_unique')
        and exists (select 1 from pg_constraint where conname = 'reservations_primary_guest_property_fkey')
        and exists (select 1 from pg_constraint where conname = 'reservation_guests_reservation_property_fkey')
        and exists (select 1 from pg_constraint where conname = 'reservation_guests_guest_property_fkey')
        and not exists (select 1 from pg_constraint where conname in ('identity_documents_guest_id_fkey', 'identity_documents_type_issuing_country_document_number_key', 'reservations_primary_guest_id_fkey', 'reservation_guests_reservation_id_fkey', 'reservation_guests_guest_id_fkey')) as guest_scope_ready,
      to_regclass('public.sessions') is not null and to_regclass('public.role_permissions') is not null as security_ready,
      (select count(*) = 2 from pg_trigger where tgname in ('audit_events_append_only', 'audit_events_no_truncate') and not tgisinternal) as audit_guard_ready,
      exists (select 1 from pg_indexes where indexname = 'sessions_one_active_per_account' and indexdef like '%WHERE (revoked_at IS NULL)%') as session_guard_ready,
       (select array_agg(key order by key) = array['administrator','cleaning','kitchen','receptionist']::varchar[] from roles where is_system) as system_roles_ready,
        to_regclass('public.folio_entries') is not null
          and exists (select 1 from pg_constraint where conname = 'folio_entries_property_source_unique')
          and exists (select 1 from pg_constraint where conname = 'folio_entries_property_idempotency_unique')
          and exists (select 1 from pg_indexes where indexname = 'folio_entries_one_reversal_idx')
          and exists (select 1 from pg_constraint where conname = 'cash_movements_property_reference_unique') as folio_ready,
       exists (select 1 from information_schema.columns where table_name = 'cleaning_tasks' and column_name = 'stay_id')
         and exists (select 1 from pg_constraint where conname = 'cleaning_tasks_stay_property_fkey')
         and exists (select 1 from pg_indexes where indexname = 'cleaning_tasks_stay_unique' and indexdef like '%WHERE (stay_id IS NOT NULL)%') as cleaning_stay_ready`);
    expect(result.rows[0]).toEqual({ schema_ready: true, constraint_ready: true, guest_scope_ready: true, security_ready: true, audit_guard_ready: true, session_guard_ready: true, system_roles_ready: true, folio_ready: true, cleaning_stay_ready: true });
  });
});

describe('PostgreSQL room invariants', () => {
  it('allows the same room number across properties and rejects a cross-property category', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const firstPropertyId = randomUUID();
      const secondPropertyId = randomUUID();
      const firstCategoryId = randomUUID();
      const secondCategoryId = randomUUID();
      await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3), ($4, $5, $6)', [firstPropertyId, `inv-room-1-${suffix.slice(0, 18)}`, 'First Room Property', secondPropertyId, `inv-room-2-${suffix.slice(0, 18)}`, 'Second Room Property']);
      await client.query('INSERT INTO room_categories (id, property_id, code, name, capacity, base_nightly_rate) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)', [firstCategoryId, firstPropertyId, 'SIMPLE', 'Simple', 1, '95.00', secondCategoryId, secondPropertyId, 'SIMPLE', 'Simple', 1, '95.00']);
      await client.query('INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $4, $5)', [randomUUID(), firstPropertyId, firstCategoryId, '101', 1, randomUUID(), secondPropertyId, secondCategoryId]);

      const crossPropertyCategory = await captureViolation(client, () => client.query(
        'INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5)',
        [randomUUID(), firstPropertyId, secondCategoryId, '102', 1],
      ));
      expectPostgresViolation(crossPropertyCategory, '23503', 'rooms_category_id_property_id_fkey');

      const roomsByProperty = await client.query<{ property_id: string; number: string }>('SELECT property_id, number FROM rooms WHERE property_id = ANY($1::uuid[]) ORDER BY property_id', [[firstPropertyId, secondPropertyId]]);
      expect(roomsByProperty.rows).toEqual([{ property_id: firstPropertyId, number: '101' }, { property_id: secondPropertyId, number: '101' }].toSorted((left, right) => left.property_id.localeCompare(right.property_id)));
    });
  });
});

describe('PostgreSQL guest invariants', () => {
  it('isolates document ownership by property and persists guest profile fields', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const firstPropertyId = randomUUID();
      const secondPropertyId = randomUUID();
      const firstGuestId = randomUUID();
      const secondGuestId = randomUUID();
      await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3), ($4, $5, $6)', [firstPropertyId, `inv-g1-${suffix.slice(0, 24)}`, 'First Guest Property', secondPropertyId, `inv-g2-${suffix.slice(0, 24)}`, 'Second Guest Property']);
      await client.query(`INSERT INTO guests
        (id, property_id, first_name, last_name, nationality, address, emergency_contact, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8), ($9, $10, $11, $12, $13, $14, $15, $16)`,
      [firstGuestId, firstPropertyId, 'Ada', 'Lovelace', 'GB', 'London', 'Charles Babbage', 'First programmer', secondGuestId, secondPropertyId, 'Grace', 'Hopper', 'US', 'New York', 'Emergency contact', 'Compiler pioneer']);
      await client.query(`INSERT INTO identity_documents
        (guest_id, property_id, type, issuing_country, document_number, is_primary)
        VALUES ($1, $2, 'passport', 'GB', $3, true), ($4, $5, 'passport', 'GB', $3, true)`,
      [firstGuestId, firstPropertyId, `DOC-${suffix}`, secondGuestId, secondPropertyId]);
      await client.query(`INSERT INTO identity_documents
        (guest_id, property_id, type, issuing_country, document_number, is_primary)
        VALUES ($1, $2, 'other', 'GB', $3, false)`,
      [firstGuestId, firstPropertyId, `SECONDARY-${suffix}`]);

      const inconsistentProperty = await captureViolation(client, () => client.query(`INSERT INTO identity_documents
        (guest_id, property_id, type, issuing_country, document_number, is_primary)
        VALUES ($1, $2, 'dni', 'PE', $3, false)`, [firstGuestId, secondPropertyId, `MISMATCH-${suffix}`]));
      expectPostgresViolation(inconsistentProperty, '23503', 'identity_documents_guest_property_fkey');

      const duplicatePrimary = await captureViolation(client, () => client.query(`INSERT INTO identity_documents
        (guest_id, property_id, type, issuing_country, document_number, is_primary)
        VALUES ($1, $2, 'other', 'GB', $3, true)`, [firstGuestId, firstPropertyId, `PRIMARY-${suffix}`]));
      expectPostgresViolation(duplicatePrimary, '23505', 'identity_documents_one_primary_idx');

      const duplicateWithinProperty = await captureViolation(client, () => client.query(`INSERT INTO identity_documents
        (guest_id, property_id, type, issuing_country, document_number, is_primary)
        VALUES ($1, $2, 'passport', 'GB', $3, false)`, [firstGuestId, firstPropertyId, `DOC-${suffix}`]));
      expectPostgresViolation(duplicateWithinProperty, '23505', 'identity_documents_property_document_unique');

      const profile = await client.query<{ nationality: string; address: string; emergency_contact: string; notes: string }>(
        'SELECT nationality, address, emergency_contact, notes FROM guests WHERE id = $1 AND property_id = $2',
        [firstGuestId, firstPropertyId],
      );
      expect(profile.rows).toEqual([{ nationality: 'GB', address: 'London', emergency_contact: 'Charles Babbage', notes: 'First programmer' }]);
      const documents = await client.query<{ document_count: number; primary_count: number }>(`SELECT
        count(*)::integer AS document_count,
        count(*) FILTER (WHERE is_primary)::integer AS primary_count
        FROM identity_documents WHERE guest_id = $1`, [firstGuestId]);
      expect(documents.rows).toEqual([{ document_count: 2, primary_count: 1 }]);
    });
  });
});

describe('PostgreSQL reservation invariants', () => {
  it('allows only one primary guest per reservation', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: ReservationFixture = {
        propertyId: randomUUID(),
        categoryId: randomUUID(),
        roomId: randomUUID(),
        primaryGuestId: randomUUID(),
        secondaryGuestId: randomUUID(),
        propertyCode: `inv-pg-${suffix.slice(0, 25)}`,
        roomNumber: `pg-${suffix.slice(0, 13)}`,
      };
      const reservationId = randomUUID();
      await insertReservationDependencies(client, fixture);
      await client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [reservationId, fixture.propertyId, fixture.roomId, fixture.primaryGuestId, 'confirmed', '2030-01-10', '2030-01-12', '2030-01-10T15:00:00.000Z', '2030-01-12T11:00:00.000Z', 2, '100.00', '200.00']);
      await client.query('INSERT INTO reservation_guests (reservation_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, $4)', [reservationId, fixture.primaryGuestId, fixture.propertyId, true]);

      const error = await captureViolation(client, () => client.query(
        'INSERT INTO reservation_guests (reservation_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, $4)',
        [reservationId, fixture.secondaryGuestId, fixture.propertyId, true],
      ));
      expectPostgresViolation(error, '23505', 'reservation_guests_one_primary_idx');

      const remaining = await client.query<{ guest_id: string; is_primary: boolean }>(
        'SELECT guest_id, is_primary FROM reservation_guests WHERE reservation_id = $1 ORDER BY guest_id',
        [reservationId],
      );
      expect(remaining.rows).toEqual([{ guest_id: fixture.primaryGuestId, is_primary: true }]);
    });
  });

  it('rejects cross-property primary and additional guests while allowing same-property relations', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const firstPropertyId = randomUUID();
      const secondPropertyId = randomUUID();
      const categoryId = randomUUID();
      const roomId = randomUUID();
      const firstGuestId = randomUUID();
      const secondGuestId = randomUUID();
      const reservationId = randomUUID();
      await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3), ($4, $5, $6)', [firstPropertyId, `inv-r1-${suffix.slice(0, 24)}`, 'First Reservation Property', secondPropertyId, `inv-r2-${suffix.slice(0, 24)}`, 'Second Reservation Property']);
      await client.query('INSERT INTO room_categories (id, property_id, code, name, capacity, base_nightly_rate) VALUES ($1, $2, $3, $4, $5, $6)', [categoryId, firstPropertyId, 'SCOPE', 'Scope Test Category', 2, '100.00']);
      await client.query('INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5)', [roomId, firstPropertyId, categoryId, `sc-${suffix.slice(0, 13)}`, 1]);
      await client.query('INSERT INTO guests (id, property_id, first_name, last_name) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [firstGuestId, firstPropertyId, 'Same', 'Property', secondGuestId, secondPropertyId, 'Other', 'Property']);

      const crossPropertyPrimary = await captureViolation(client, () => client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES ($1, $2, $3, $4, 'confirmed', '2030-03-10', '2030-03-12', '2030-03-10T15:00:00.000Z', '2030-03-12T11:00:00.000Z', 1, '100.00', '200.00')`,
      [randomUUID(), firstPropertyId, roomId, secondGuestId]));
      expectPostgresViolation(crossPropertyPrimary, '23503', 'reservations_primary_guest_property_fkey');

      await client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES ($1, $2, $3, $4, 'confirmed', '2030-03-10', '2030-03-12', '2030-03-10T15:00:00.000Z', '2030-03-12T11:00:00.000Z', 2, '100.00', '200.00')`,
      [reservationId, firstPropertyId, roomId, firstGuestId]);
      await client.query('INSERT INTO reservation_guests (reservation_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, true)', [reservationId, firstGuestId, firstPropertyId]);

      const crossPropertyAdditional = await captureViolation(client, () => client.query(
        'INSERT INTO reservation_guests (reservation_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, false)',
        [reservationId, secondGuestId, firstPropertyId],
      ));
      expectPostgresViolation(crossPropertyAdditional, '23503', 'reservation_guests_guest_property_fkey');

      const related = await client.query<{ reservation_id: string; guest_id: string; property_id: string }>(
        'SELECT reservation_id, guest_id, property_id FROM reservation_guests WHERE reservation_id = $1',
        [reservationId],
      );
      expect(related.rows).toEqual([{ reservation_id: reservationId, guest_id: firstGuestId, property_id: firstPropertyId }]);
    });
  });

  it('rejects overlapping active reservations for the same room', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: ReservationFixture = {
        propertyId: randomUUID(),
        categoryId: randomUUID(),
        roomId: randomUUID(),
        primaryGuestId: randomUUID(),
        secondaryGuestId: randomUUID(),
        propertyCode: `inv-ov-${suffix.slice(0, 25)}`,
        roomNumber: `ov-${suffix.slice(0, 13)}`,
      };
      const firstReservationId = randomUUID();
      const secondReservationId = randomUUID();
      await insertReservationDependencies(client, fixture);
      await client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [firstReservationId, fixture.propertyId, fixture.roomId, fixture.primaryGuestId, 'confirmed', '2030-02-10', '2030-02-14', '2030-02-10T15:00:00.000Z', '2030-02-14T11:00:00.000Z', 1, '100.00', '400.00']);

      const error = await captureViolation(client, () => client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [secondReservationId, fixture.propertyId, fixture.roomId, fixture.secondaryGuestId, 'pending', '2030-02-12', '2030-02-16', '2030-02-12T15:00:00.000Z', '2030-02-16T11:00:00.000Z', 1, '100.00', '400.00']));
      expectPostgresViolation(error, '23P01', 'reservations_no_active_overlap');

      const remaining = await client.query<{ id: string }>(
        'SELECT id FROM reservations WHERE id = ANY($1::uuid[]) ORDER BY id',
        [[firstReservationId, secondReservationId]],
      );
      expect(remaining.rows).toEqual([{ id: firstReservationId }]);
    });
  });

  it('allows adjacent active reservations and overlap from an inactive status', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: ReservationFixture = {
        propertyId: randomUUID(),
        categoryId: randomUUID(),
        roomId: randomUUID(),
        primaryGuestId: randomUUID(),
        secondaryGuestId: randomUUID(),
        propertyCode: `inv-ad-${suffix.slice(0, 25)}`,
        roomNumber: `ad-${suffix.slice(0, 13)}`,
      };
      const reservationIds = [randomUUID(), randomUUID(), randomUUID()];
      await insertReservationDependencies(client, fixture);
      await client.query(`INSERT INTO reservations
        (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
        VALUES
          ($1, $4, $5, $6, 'confirmed', '2030-04-10', '2030-04-12', '2030-04-10T15:00:00.000Z', '2030-04-12T11:00:00.000Z', 1, '100.00', '200.00'),
          ($2, $4, $5, $7, 'pending', '2030-04-12', '2030-04-14', '2030-04-12T11:00:00.000Z', '2030-04-14T11:00:00.000Z', 1, '100.00', '200.00'),
          ($3, $4, $5, $6, 'cancelled', '2030-04-11', '2030-04-13', '2030-04-11T15:00:00.000Z', '2030-04-13T11:00:00.000Z', 1, '100.00', '200.00')`,
      [...reservationIds, fixture.propertyId, fixture.roomId, fixture.primaryGuestId, fixture.secondaryGuestId]);

      const persisted = await client.query<{ reservation_count: number }>(
        'SELECT count(*)::integer AS reservation_count FROM reservations WHERE id = ANY($1::uuid[])',
        [reservationIds],
      );
      expect(persisted.rows).toEqual([{ reservation_count: 3 }]);
    });
  });
});

describe('PostgreSQL security invariants', () => {
  it('allows only one active session per account', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const propertyId = randomUUID();
      const roleId = randomUUID();
      const accountId = randomUUID();
      const firstSessionId = randomUUID();
      const secondSessionId = randomUUID();
      await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3)', [propertyId, `inv-se-${suffix.slice(0, 25)}`, 'Session Invariant Property']);
      await client.query('INSERT INTO roles (id, key, name) VALUES ($1, $2, $3)', [roleId, `invariant_session_${suffix}`, 'Invariant Session Role']);
      await client.query('INSERT INTO accounts (id, property_id, role_id, email, password_hash) VALUES ($1, $2, $3, $4, $5)', [accountId, propertyId, roleId, `inv-session-${suffix}@example.invalid`, 'integration-test-only']);
      await client.query('INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [firstSessionId, accountId, randomTokenHash('a'), '2035-01-01T00:00:00.000Z']);

      const error = await captureViolation(client, () => client.query(
        'INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
        [secondSessionId, accountId, randomTokenHash('b'), '2035-01-01T00:00:00.000Z'],
      ));
      expectPostgresViolation(error, '23505', 'sessions_one_active_per_account');

      const activeSessions = await client.query<{ id: string }>(
        'SELECT id FROM sessions WHERE account_id = $1 AND revoked_at IS NULL ORDER BY id',
        [accountId],
      );
      expect(activeSessions.rows).toEqual([{ id: firstSessionId }]);
    });
  });

  it('keeps audit events append-only across update, delete, and truncate attempts', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const eventId = randomUUID();
      const original = {
        event_type: 'integration.invariant',
        request_id: `inv-audit-${suffix}`,
        metadata: { source: 'database.integration.spec' },
      };
      // Serialize the table-wide TRUNCATE assertion across cooperating test runs without using production lock namespaces.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, $2))', ['integration-test:audit-events-truncate', 0]);
      await client.query(
        'INSERT INTO audit_events (id, event_type, request_id, metadata) VALUES ($1, $2, $3, $4::jsonb)',
        [eventId, original.event_type, original.request_id, JSON.stringify(original.metadata)],
      );

      const updateError = await captureViolation(client, () => client.query(
        'UPDATE audit_events SET request_id = $1 WHERE id = $2',
        ['invariant-audit-mutated', eventId],
      ));
      expect(postgresErrorField(updateError, 'code')).toBe('P0001');
      expect(postgresErrorField(updateError, 'message')).toContain('audit_events is append-only');

      const deleteError = await captureViolation(client, () => client.query('DELETE FROM audit_events WHERE id = $1', [eventId]));
      expect(postgresErrorField(deleteError, 'code')).toBe('P0001');
      expect(postgresErrorField(deleteError, 'message')).toContain('audit_events is append-only');

      const truncateError = await captureViolation(client, () => client.query('TRUNCATE TABLE audit_events'));
      expect(postgresErrorField(truncateError, 'code')).toBe('P0001');
      expect(postgresErrorField(truncateError, 'message')).toContain('audit_events is append-only');

      const remaining = await client.query<{ event_type: string; request_id: string | null; metadata: Record<string, unknown> }>(
        'SELECT event_type, request_id, metadata FROM audit_events WHERE id = $1',
        [eventId],
      );
      expect(remaining.rows).toEqual([original]);
    });
  });
});

interface StayFixture extends ReservationFixture {
  reservationId: string;
  stayId: string;
}

async function insertStayDependencies(client: PoolClient, fixture: StayFixture): Promise<void> {
  await insertReservationDependencies(client, fixture);
  await client.query(
    `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
     VALUES ($1, $2, $3, $4, 'checked_in', '2035-06-10', '2035-06-12', '2035-06-10T15:00:00.000Z', '2035-06-12T11:00:00.000Z', 1, '100.00', '200.00')`,
    [fixture.reservationId, fixture.propertyId, fixture.roomId, fixture.primaryGuestId],
  );
  await client.query(
    `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at)
     VALUES ($1, $2, $3, $4, 'active', '2035-06-10T15:00:00.000Z')`,
    [fixture.stayId, fixture.propertyId, fixture.reservationId, fixture.roomId],
  );
}

describe('PostgreSQL stay invariants', () => {
  it('rejects a second active stay for the same reservation', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-sa-${suffix.slice(0, 25)}`, roomNumber: `sa-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      await insertStayDependencies(client, fixture);

      const error = await captureViolation(client, () => client.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at)
         VALUES ($1, $2, $3, $4, 'active', '2035-06-10T15:00:00.000Z')`,
        [randomUUID(), fixture.propertyId, fixture.reservationId, fixture.roomId],
      ));
      expectPostgresViolation(error, '23505', 'stays_one_active_per_reservation_idx');

      const count = await client.query<{ n: number }>(
        'SELECT count(*)::integer AS n FROM stays WHERE reservation_id = $1',
        [fixture.reservationId],
      );
      expect(count.rows).toEqual([{ n: 1 }]);
    });
  });

  it('rejects a second active stay for the same room', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-sr-${suffix.slice(0, 25)}`, roomNumber: `sr-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      const secondReservationId = randomUUID();
      await insertStayDependencies(client, fixture);
      await client.query(
        `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
         VALUES ($1, $2, $3, $4, 'checked_in', '2035-07-01', '2035-07-03', '2035-07-01T15:00:00.000Z', '2035-07-03T11:00:00.000Z', 1, '100.00', '200.00')`,
        [secondReservationId, fixture.propertyId, fixture.roomId, fixture.secondaryGuestId],
      );

      const error = await captureViolation(client, () => client.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at)
         VALUES ($1, $2, $3, $4, 'active', '2035-07-01T15:00:00.000Z')`,
        [randomUUID(), fixture.propertyId, secondReservationId, fixture.roomId],
      ));
      expectPostgresViolation(error, '23505', 'stays_one_active_per_room_idx');
    });
  });

  it('allows multiple checked_out stays for the same room', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-sc-${suffix.slice(0, 25)}`, roomNumber: `sc-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      const secondReservationId = randomUUID();
      const secondStayId = randomUUID();
      await insertStayDependencies(client, fixture);
      await client.query(
        `UPDATE stays SET status = 'checked_out', check_out_at = '2035-06-12T11:00:00.000Z' WHERE id = $1`,
        [fixture.stayId],
      );
      await client.query(
        `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
         VALUES ($1, $2, $3, $4, 'checked_in', '2035-07-01', '2035-07-03', '2035-07-01T15:00:00.000Z', '2035-07-03T11:00:00.000Z', 1, '100.00', '200.00')`,
        [secondReservationId, fixture.propertyId, fixture.roomId, fixture.secondaryGuestId],
      );
      await client.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at)
         VALUES ($1, $2, $3, $4, 'active', '2035-07-01T15:00:00.000Z')`,
        [secondStayId, fixture.propertyId, secondReservationId, fixture.roomId],
      );

      const count = await client.query<{ n: number }>(
        'SELECT count(*)::integer AS n FROM stays WHERE room_id = $1',
        [fixture.roomId],
      );
      expect(count.rows).toEqual([{ n: 2 }]);
    });
  });

  it('rejects active stay with non-null check_out_at (checkout state check)', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-ck-${suffix.slice(0, 25)}`, roomNumber: `ck-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      await insertReservationDependencies(client, fixture);
      await client.query(
        `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
         VALUES ($1, $2, $3, $4, 'checked_in', '2035-08-10', '2035-08-12', '2035-08-10T15:00:00.000Z', '2035-08-12T11:00:00.000Z', 1, '100.00', '200.00')`,
        [fixture.reservationId, fixture.propertyId, fixture.roomId, fixture.primaryGuestId],
      );

      const error = await captureViolation(client, () => client.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at, check_out_at)
         VALUES ($1, $2, $3, $4, 'active', '2035-08-10T15:00:00.000Z', '2035-08-12T11:00:00.000Z')`,
        [randomUUID(), fixture.propertyId, fixture.reservationId, fixture.roomId],
      ));
      expectPostgresViolation(error, '23514', 'stays_checkout_state_check');
    });
  });

  it('rejects cross-property room FK on stay insert', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const firstPropertyId = randomUUID();
      const secondPropertyId = randomUUID();
      const firstCategoryId = randomUUID();
      const secondCategoryId = randomUUID();
      const firstRoomId = randomUUID();
      const secondRoomId = randomUUID();
      const guestId = randomUUID();
      const reservationId = randomUUID();

      await client.query(
        'INSERT INTO properties (id, code, name) VALUES ($1, $2, $3), ($4, $5, $6)',
        [firstPropertyId, `inv-sp1-${suffix.slice(0, 22)}`, 'Stay Scope One', secondPropertyId, `inv-sp2-${suffix.slice(0, 22)}`, 'Stay Scope Two'],
      );
      await client.query(
        'INSERT INTO room_categories (id, property_id, code, name, capacity, base_nightly_rate) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)',
        [firstCategoryId, firstPropertyId, 'CAT', 'Cat', 1, '100.00', secondCategoryId, secondPropertyId, 'CAT', 'Cat', 1, '100.00'],
      );
      await client.query(
        'INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $4, $5)',
        [firstRoomId, firstPropertyId, firstCategoryId, `sp-${suffix.slice(0, 13)}`, 1, secondRoomId, secondPropertyId, secondCategoryId],
      );
      await client.query('INSERT INTO guests (id, property_id, first_name, last_name) VALUES ($1, $2, $3, $4)', [guestId, firstPropertyId, 'Scope', 'Test']);
      await client.query(
        `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
         VALUES ($1, $2, $3, $4, 'checked_in', '2035-09-10', '2035-09-12', '2035-09-10T15:00:00.000Z', '2035-09-12T11:00:00.000Z', 1, '100.00', '200.00')`,
        [reservationId, firstPropertyId, firstRoomId, guestId],
      );

      const crossRoom = await captureViolation(client, () => client.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at)
         VALUES ($1, $2, $3, $4, 'active', '2035-09-10T15:00:00.000Z')`,
        [randomUUID(), firstPropertyId, reservationId, secondRoomId],
      ));
      expectPostgresViolation(crossRoom, '23503', 'stays_room_property_fkey');
    });
  });

  it('rejects duplicate primary and cross-property guest in stay_guests', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-sg-${suffix.slice(0, 25)}`, roomNumber: `sg-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      const otherPropertyId = randomUUID();
      const otherGuestId = randomUUID();
      await insertStayDependencies(client, fixture);
      await client.query(
        `INSERT INTO stay_guests (stay_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, true)`,
        [fixture.stayId, fixture.primaryGuestId, fixture.propertyId],
      );

      const duplicatePrimary = await captureViolation(client, () => client.query(
        `INSERT INTO stay_guests (stay_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, true)`,
        [fixture.stayId, fixture.secondaryGuestId, fixture.propertyId],
      ));
      expectPostgresViolation(duplicatePrimary, '23505', 'stay_guests_one_primary_idx');

      await client.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3)', [otherPropertyId, `inv-sgp-${suffix.slice(0, 23)}`, 'Other Stay Guest']);
      await client.query('INSERT INTO guests (id, property_id, first_name, last_name) VALUES ($1, $2, $3, $4)', [otherGuestId, otherPropertyId, 'Cross', 'Property']);
      const crossPropertyGuest = await captureViolation(client, () => client.query(
        `INSERT INTO stay_guests (stay_id, guest_id, property_id, is_primary) VALUES ($1, $2, $3, false)`,
        [fixture.stayId, otherGuestId, fixture.propertyId],
      ));
      expectPostgresViolation(crossPropertyGuest, '23503', 'stay_guests_guest_property_fkey');

      const guestCount = await client.query<{ n: number }>(
        'SELECT count(*)::integer AS n FROM stay_guests WHERE stay_id = $1',
        [fixture.stayId],
      );
      expect(guestCount.rows).toEqual([{ n: 1 }]);
    });
  });

  it('rejects a folio with non-zero opening balance', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(),
        primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-fo-${suffix.slice(0, 25)}`, roomNumber: `fo-${suffix.slice(0, 13)}`,
        reservationId: randomUUID(), stayId: randomUUID(),
      };
      await insertStayDependencies(client, fixture);

      const error = await captureViolation(client, () => client.query(
        `INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '50.00')`,
        [randomUUID(), fixture.propertyId, fixture.stayId],
      ));
      expectPostgresViolation(error, '23514', 'folios_zero_opening_balance_check');

      await client.query(
        `INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`,
        [randomUUID(), fixture.propertyId, fixture.stayId],
      );
      const folio = await client.query<{ n: number }>(
        'SELECT count(*)::integer AS n FROM folios WHERE stay_id = $1',
        [fixture.stayId],
      );
      expect(folio.rows).toEqual([{ n: 1 }]);
    });
  });

  it('concurrent check-in: only one transaction can claim the same room', async () => {
    const suffix = uniqueHex();
    const propertyId = randomUUID();
    const categoryId = randomUUID();
    const roomId = randomUUID();
    const guestOneId = randomUUID();
    const guestTwoId = randomUUID();
    const reservationOneId = randomUUID();
    const reservationTwoId = randomUUID();

    const setup = await pool.connect();
    try {
      await setup.query('BEGIN');
      await setup.query('INSERT INTO properties (id, code, name) VALUES ($1, $2, $3)', [propertyId, `inv-cc-${suffix.slice(0, 24)}`, 'Concurrent Claim Property']);
      await setup.query('INSERT INTO room_categories (id, property_id, code, name, capacity, base_nightly_rate) VALUES ($1, $2, $3, $4, $5, $6)', [categoryId, propertyId, 'CC', 'Concurrent', 1, '100.00']);
      await setup.query('INSERT INTO rooms (id, property_id, category_id, number, floor) VALUES ($1, $2, $3, $4, $5)', [roomId, propertyId, categoryId, `cc-${suffix.slice(0, 13)}`, 1]);
      await setup.query('INSERT INTO guests (id, property_id, first_name, last_name) VALUES ($1, $2, $3, $4), ($5, $2, $6, $7)', [guestOneId, propertyId, 'Concurrent', 'One', guestTwoId, 'Concurrent', 'Two']);
      await setup.query(
        `INSERT INTO reservations (id, property_id, room_id, primary_guest_id, status, check_in, check_out, check_in_at, check_out_at, guest_count, nightly_rate, total_amount)
         VALUES ($1, $2, $3, $4, 'checked_in', '2036-01-10', '2036-01-12', '2036-01-10T15:00:00.000Z', '2036-01-12T11:00:00.000Z', 1, '100.00', '200.00'),
                ($5, $2, $3, $6, 'checked_in', '2036-01-13', '2036-01-15', '2036-01-13T15:00:00.000Z', '2036-01-15T11:00:00.000Z', 1, '100.00', '200.00')`,
        [reservationOneId, propertyId, roomId, guestOneId, reservationTwoId, guestTwoId],
      );
      await setup.query('COMMIT');
    } finally {
      setup.release();
    }

    const pool2 = new Pool({ connectionString: databaseUrlFromEnv(env), max: 2 });
    const clientA = await pool2.connect();
    const clientB = await pool2.connect();
    const stayAId = randomUUID();
    const stayBId = randomUUID();
    let errorB: unknown;

    try {
      await clientA.query('BEGIN');
      await clientB.query('BEGIN');

      await clientA.query(
        `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at) VALUES ($1, $2, $3, $4, 'active', '2036-01-10T15:00:00.000Z')`,
        [stayAId, propertyId, reservationOneId, roomId],
      );
      await clientA.query('COMMIT');

      try {
        await clientB.query(
          `INSERT INTO stays (id, property_id, reservation_id, room_id, status, check_in_at) VALUES ($1, $2, $3, $4, 'active', '2036-01-13T15:00:00.000Z')`,
          [stayBId, propertyId, reservationTwoId, roomId],
        );
        await clientB.query('COMMIT');
      } catch (e) {
        errorB = e;
        await clientB.query('ROLLBACK');
      }
    } finally {
      clientA.release();
      clientB.release();
      await pool2.end();
    }

    expectPostgresViolation(errorB, '23505', 'stays_one_active_per_room_idx');

    const persisted = await pool.query<{ n: number }>(
      `SELECT count(*)::integer AS n FROM stays WHERE room_id = $1 AND status = 'active'`,
      [roomId],
    );
    expect(persisted.rows).toEqual([{ n: 1 }]);

    // Cleanup committed fixture
    await pool.query('DELETE FROM stays WHERE room_id = $1', [roomId]);
    await pool.query('DELETE FROM reservations WHERE property_id = $1', [propertyId]);
    await pool.query('DELETE FROM guests WHERE property_id = $1', [propertyId]);
    await pool.query('DELETE FROM rooms WHERE property_id = $1', [propertyId]);
    await pool.query('DELETE FROM room_categories WHERE property_id = $1', [propertyId]);
    await pool.query('DELETE FROM properties WHERE id = $1', [propertyId]);
  });
});

describe('PostgreSQL financial folio invariants', () => {
  it('posts one real UUID ancillary entry for a deterministic parking-exit replay', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = { propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(), primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(), propertyCode: `inv-af-${suffix.slice(0, 25)}`, roomNumber: `af-${suffix.slice(0, 13)}`, reservationId: randomUUID(), stayId: randomUUID() };
      const roleId = randomUUID(); const accountId = randomUUID(); const folioId = randomUUID();
      await insertStayDependencies(client, fixture);
      await client.query('INSERT INTO roles (id, key, name) VALUES ($1, $2, $3)', [roleId, `ancillary_${suffix}`, 'Ancillary Test Role']);
      await client.query('INSERT INTO accounts (id, property_id, role_id, email, password_hash) VALUES ($1, $2, $3, $4, $5)', [accountId, fixture.propertyId, roleId, `ancillary-${suffix}@example.invalid`, 'integration-test-only']);
      await client.query(`INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`, [folioId, fixture.propertyId, fixture.stayId]);
      const database = drizzle(client, { schema });
      const folios = new FolioService(database, { record: async () => undefined } as never);
      const actor: AuthenticatedAccount = { accountId, propertyId: fixture.propertyId, roleKey: 'test', email: `ancillary-${suffix}@example.invalid`, permissions: [], sessionId: 'test', passwordChangeRequired: false };
      const first = await folios.appendAncillaryChargeLocked(database as any, actor, { stayId: fixture.stayId, sourceType: 'parking_exit', sourceId: 'VEH-TEST', amount: '7.50' as any, reason: 'Parking exit' }, { requestId: 'ancillary-test' });
      const replay = await folios.appendAncillaryChargeLocked(database as any, actor, { stayId: fixture.stayId, sourceType: 'parking_exit', sourceId: 'VEH-TEST', amount: '7.50' as any, reason: 'Parking exit' }, { requestId: 'ancillary-test' });
      expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(replay).toEqual(first);
      const entries = await client.query<{ id: string }>('SELECT id FROM folio_entries WHERE property_id = $1 AND source_type = $2 AND source_id = $3', [fixture.propertyId, 'parking_exit', 'VEH-TEST']);
      expect(entries.rows).toEqual([{ id: first.id }]);
    });
  });

  it('keeps entries property-scoped, decimal-safe, and deduplicated by source, key, and reversal', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = {
        propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(), primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(),
        propertyCode: `inv-fl-${suffix.slice(0, 25)}`, roomNumber: `fl-${suffix.slice(0, 13)}`, reservationId: randomUUID(), stayId: randomUUID(),
      };
      await insertStayDependencies(client, fixture);
      const folioId = randomUUID();
      const chargeId = randomUUID();
      const sourceId = randomUUID();
      await client.query(`INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`, [folioId, fixture.propertyId, fixture.stayId]);
      await client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, actor_account_id)
        VALUES ($1, $2, $3, $4, 'charge', '12.50', 'manual_charge', $5, $6, $7)`, [chargeId, fixture.propertyId, folioId, fixture.stayId, sourceId, randomUUID(), randomUUID()]);

      const invalidMethod = await captureViolation(client, () => client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, payment_method, source_type, source_id, idempotency_key, actor_account_id)
        VALUES ($1, $2, $3, $4, 'payment', '1.00', 'Crypto', 'manual_payment', $5, $6, $7)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, randomUUID(), randomUUID(), randomUUID()]));
      expectPostgresViolation(invalidMethod, '23514', 'folio_entries_payment_method_check');
      const duplicateSource = await captureViolation(client, () => client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, actor_account_id)
        VALUES ($1, $2, $3, $4, 'charge', '12.50', 'manual_charge', $5, $6, $7)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, sourceId, randomUUID(), randomUUID()]));
      expectPostgresViolation(duplicateSource, '23505', 'folio_entries_property_source_unique');
      await client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, reversal_of_entry_id, actor_account_id)
        VALUES ($1, $2, $3, $4, 'reversal', '12.50', 'manual_reversal', $5, $6, $7, $8)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, randomUUID(), randomUUID(), chargeId, randomUUID()]);
      const duplicateReversal = await captureViolation(client, () => client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, reversal_of_entry_id, actor_account_id)
        VALUES ($1, $2, $3, $4, 'reversal', '12.50', 'manual_reversal', $5, $6, $7, $8)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, randomUUID(), randomUUID(), chargeId, randomUUID()]));
      expectPostgresViolation(duplicateReversal, '23505', 'folio_entries_one_reversal_idx');
    });
  });

  it('scenario: Reconciliation corrects divergent projections without changing another property', async () => {
    await inRolledBackTransaction(async (client) => {
      const suffix = uniqueHex();
      const fixture: StayFixture = { propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(), primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(), propertyCode: `inv-rv-${suffix.slice(0, 25)}`, roomNumber: `rv-${suffix.slice(0, 13)}`, reservationId: randomUUID(), stayId: randomUUID() };
      const other: StayFixture = { propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(), primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(), propertyCode: `inv-ro-${suffix.slice(0, 25)}`, roomNumber: `ro-${suffix.slice(0, 13)}`, reservationId: randomUUID(), stayId: randomUUID() };
      const folioId = randomUUID(); const otherFolioId = randomUUID();
      await insertStayDependencies(client, fixture);
      await insertStayDependencies(client, other);
      await client.query(`UPDATE stays SET status = 'checked_out', settlement = 'receivable', check_out_at = now() WHERE id = $1`, [fixture.stayId]);
      await client.query(`UPDATE stays SET status = 'checked_out', settlement = 'receivable', check_out_at = now() WHERE id = $1`, [other.stayId]);
      await client.query(`INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`, [folioId, fixture.propertyId, fixture.stayId]);
      await client.query(`INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`, [otherFolioId, other.propertyId, other.stayId]);
      await client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, actor_account_id) VALUES ($1, $2, $3, $4, 'charge', '12.50', 'manual_charge', $5, $6, $7)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, randomUUID(), randomUUID(), randomUUID()]);
      await client.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, actor_account_id) VALUES ($1, $2, $3, $4, 'charge', '7.00', 'manual_charge', $5, $6, $7)`, [randomUUID(), other.propertyId, otherFolioId, other.stayId, randomUUID(), randomUUID(), randomUUID()]);
      await client.query(`INSERT INTO receivables (property_id, stay_id, reservation_id, primary_guest_id, folio_id, status, original_amount, outstanding_amount, reason, opened_at, settled_at) VALUES ($1, $2, $3, $4, $5, 'settled', '12.50', '0.00', 'divergent', now(), now()), ($6, $7, $8, $9, $10, 'open', '7.00', '7.00', 'other', now(), null)`, [fixture.propertyId, fixture.stayId, fixture.reservationId, fixture.primaryGuestId, folioId, other.propertyId, other.stayId, other.reservationId, other.primaryGuestId, otherFolioId]);
      await client.query(await readFile(new URL('../drizzle/0013_reconcile_receivables.sql', import.meta.url), 'utf8'));
      const projection = await client.query<{ property_id: string; outstanding_amount: string; status: string; settled_at: Date | null }>('SELECT property_id, outstanding_amount, status, settled_at FROM receivables WHERE stay_id = ANY($1::uuid[]) ORDER BY property_id', [[fixture.stayId, other.stayId]]);
      expect(projection.rows).toHaveLength(2);
      expect(projection.rows).toEqual(expect.arrayContaining([{ property_id: fixture.propertyId, outstanding_amount: '12.50' as any, status: 'open', settled_at: null }, { property_id: other.propertyId, outstanding_amount: '7.00' as any, status: 'open', settled_at: null }]));
      const commandKey = randomUUID();
      await client.query(`INSERT INTO receivable_commands (property_id, operation, idempotency_key, response) VALUES ($1, 'collection', $2, '{}'::jsonb)`, [fixture.propertyId, commandKey]);
      const duplicate = await captureViolation(client, () => client.query(`INSERT INTO receivable_commands (property_id, operation, idempotency_key, response) VALUES ($1, 'collection', $2, '{}'::jsonb)`, [fixture.propertyId, commandKey]));
      expectPostgresViolation(duplicate, '23505', 'receivable_commands_property_operation_idempotency_key_unique');
    });
  });

  it('scenario: Concurrent collection admits one payment and preserves the receivable balance', async () => {
    const suffix = uniqueHex();
    const fixture: StayFixture = { propertyId: randomUUID(), categoryId: randomUUID(), roomId: randomUUID(), primaryGuestId: randomUUID(), secondaryGuestId: randomUUID(), propertyCode: `inv-rc-${suffix.slice(0, 25)}`, roomNumber: `rc-${suffix.slice(0, 13)}`, reservationId: randomUUID(), stayId: randomUUID() };
    const folioId = randomUUID(); const receivableId = randomUUID();
    const setup = await pool.connect();
    try {
      await setup.query('BEGIN');
      await insertStayDependencies(setup, fixture);
      await setup.query(`UPDATE stays SET status = 'checked_out', settlement = 'receivable', check_out_at = now() WHERE id = $1`, [fixture.stayId]);
      await setup.query(`INSERT INTO folios (id, property_id, stay_id, opening_balance) VALUES ($1, $2, $3, '0.00')`, [folioId, fixture.propertyId, fixture.stayId]);
      await setup.query(`INSERT INTO folio_entries (id, property_id, folio_id, stay_id, type, amount, source_type, source_id, idempotency_key, actor_account_id) VALUES ($1, $2, $3, $4, 'charge', '12.50', 'manual_charge', $5, $6, $7)`, [randomUUID(), fixture.propertyId, folioId, fixture.stayId, randomUUID(), randomUUID(), randomUUID()]);
      await setup.query(`INSERT INTO receivables (id, property_id, stay_id, reservation_id, primary_guest_id, folio_id, status, original_amount, outstanding_amount, reason, opened_at) VALUES ($1, $2, $3, $4, $5, $6, 'open', '12.50', '12.50', 'race', now())`, [receivableId, fixture.propertyId, fixture.stayId, fixture.reservationId, fixture.primaryGuestId, folioId]);
      await setup.query('COMMIT');
    } finally {
      setup.release();
    }

    const actor: AuthenticatedAccount = { accountId: randomUUID(), propertyId: fixture.propertyId, roleKey: 'administrator', email: 'race@example.invalid', permissions: [], sessionId: randomUUID(), passwordChangeRequired: false };
    const racePool = new Pool({ connectionString: databaseUrlFromEnv(env), max: 2 });
    const clientA = await racePool.connect(); const clientB = await racePool.connect();
    const serviceFor = (client: PoolClient) => {
      const database = drizzle(client, { schema }); const audit = { record: async () => undefined };
      return new ReceivablesService(database, audit as never, new FolioService(database, audit as never));
    };
    try {
      const keyA = randomUUID(); const keyB = randomUUID();
      const results = await Promise.allSettled([
        serviceFor(clientA).collect(actor, receivableId, { amount: '12.50' as any, method: 'Tarjeta' }, keyA, { requestId: 'race-a' }),
        serviceFor(clientB).collect(actor, receivableId, { amount: '12.50' as any, method: 'Tarjeta' }, keyB, { requestId: 'race-b' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const accepted = results.find((result) => result.status === 'fulfilled');
      if (!accepted || accepted.status !== 'fulfilled') throw new Error('Expected one accepted collection');
      const acceptedKey = accepted === results[0] ? keyA : keyB;
      await expect(serviceFor(clientA).collect(actor, receivableId, { amount: '12.50' as any, method: 'Tarjeta' }, acceptedKey, { requestId: 'race-retry' })).resolves.toEqual(accepted.value);
      const persisted = await pool.query<{ outstanding_amount: string; status: string; payments: number }>(`SELECT r.outstanding_amount, r.status, count(e.id) FILTER (WHERE e.source_type = 'receivable_collection')::integer AS payments FROM receivables r LEFT JOIN folio_entries e ON e.folio_id = r.folio_id AND e.property_id = r.property_id WHERE r.id = $1 GROUP BY r.id`, [receivableId]);
      expect(persisted.rows).toEqual([{ outstanding_amount: '0.00' as any, status: 'settled', payments: 1 }]);
    } finally {
      clientA.release(); clientB.release(); await racePool.end();
      await pool.query('DELETE FROM folio_entries WHERE stay_id = $1', [fixture.stayId]);
      await pool.query('DELETE FROM receivable_commands WHERE property_id = $1', [fixture.propertyId]);
      await pool.query('DELETE FROM receivables WHERE stay_id = $1', [fixture.stayId]);
      await pool.query('DELETE FROM folios WHERE stay_id = $1', [fixture.stayId]);
      await pool.query('DELETE FROM stays WHERE id = $1', [fixture.stayId]);
      await pool.query('DELETE FROM reservations WHERE id = $1', [fixture.reservationId]);
      await pool.query('DELETE FROM guests WHERE property_id = $1', [fixture.propertyId]);
      await pool.query('DELETE FROM rooms WHERE id = $1', [fixture.roomId]);
      await pool.query('DELETE FROM room_categories WHERE id = $1', [fixture.categoryId]);
      await pool.query('DELETE FROM properties WHERE id = $1', [fixture.propertyId]);
    }
  });
});
