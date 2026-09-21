import { check, foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { properties } from './hotel.schema.js';
import { stays } from './stays.schema.js';

export const commandReceipts = pgTable('command_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  operation: varchar('operation', { length: 96 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  requestFingerprint: varchar('request_fingerprint', { length: 64 }).notNull(),
  responseStatus: integer('response_status').notNull().default(200),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('command_receipts_property_operation_key_unique').on(
    table.propertyId,
    table.operation,
    table.idempotencyKey,
  ),
  index('command_receipts_created_at_idx').on(table.createdAt),
]);

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }),
  stayId: uuid('stay_id'),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 64 }),
  aggregateId: varchar('aggregate_id', { length: 128 }),
  requestId: varchar('request_id', { length: 128 }),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(8),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockToken: varchar('lock_token', { length: 64 }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  errorCode: varchar('error_code', { length: 64 }),
  lastError: varchar('last_error', { length: 1_000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: 'outbox_events_stay_property_fkey',
    columns: [table.stayId, table.propertyId],
    foreignColumns: [stays.id, stays.propertyId],
  }).onDelete('restrict'),
  index('outbox_events_dispatch_idx').on(table.status, table.availableAt, table.createdAt),
  index('outbox_events_property_idx').on(table.propertyId, table.createdAt),
  index('outbox_events_stay_idx').on(table.stayId, table.createdAt),
  check('outbox_events_stay_property_required', sql`${table.stayId} IS NULL OR ${table.propertyId} IS NOT NULL`),
  check('outbox_events_status_check', sql`${table.status} IN ('pending', 'processing', 'sent', 'dead_letter')`),
  check('outbox_events_attempts_check', sql`${table.attempts} >= 0 AND ${table.maxAttempts} > 0 AND ${table.attempts} <= ${table.maxAttempts}`),
]);

export const attendanceQrNonces = pgTable('attendance_qr_nonces', {
  nonce: uuid('nonce').primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('attendance_qr_nonces_expiry_idx').on(table.expiresAt),
  index('attendance_qr_nonces_property_idx').on(table.propertyId, table.createdAt),
]);
