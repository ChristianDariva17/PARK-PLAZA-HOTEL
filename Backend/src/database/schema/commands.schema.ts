import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';

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
  eventType: varchar('event_type', { length: 100 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 64 }),
  aggregateId: varchar('aggregate_id', { length: 128 }),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lastError: varchar('last_error', { length: 1_000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('outbox_events_dispatch_idx').on(table.status, table.availableAt, table.createdAt),
  index('outbox_events_property_idx').on(table.propertyId, table.createdAt),
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
