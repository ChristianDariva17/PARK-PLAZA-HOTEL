import { foreignKey, index, jsonb, numeric, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { accounts } from './security.schema.js';

export const cashSessions = pgTable('cash_sessions', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  openedByAccountId: uuid('opened_by_account_id'),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  openingAmount: numeric('opening_amount', { precision: 14, scale: 2 }).notNull(),
  countedAmount: numeric('counted_amount', { precision: 14, scale: 2 }),
  expectedAmount: numeric('expected_amount', { precision: 14, scale: 2 }),
  difference: numeric('difference', { precision: 14, scale: 2 }),
  responsible: varchar('responsible', { length: 120 }).notNull(),
  shift: varchar('shift', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'cash_sessions_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'cash_sessions_owner_property_fkey', columns: [t.openedByAccountId, t.propertyId], foreignColumns: [accounts.id, accounts.propertyId] }).onDelete('restrict'),
  index('cash_sessions_property_created_idx').on(t.propertyId, t.createdAt),
]);

export const cashMovements = pgTable('cash_movements', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'Ingreso' | 'Egreso'
  concept: varchar('concept', { length: 200 }).notNull(),
  referenceId: varchar('reference_id', { length: 48 }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  method: varchar('method', { length: 30 }).notNull(), // Always 'Efectivo' for drawer movements
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  responsible: varchar('responsible', { length: 120 }).notNull(),
}, (t) => [
  foreignKey({ name: 'cash_movements_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'cash_movements_session_id_fkey', columns: [t.sessionId], foreignColumns: [cashSessions.id] }).onDelete('cascade'),
  index('cash_movements_session_id_idx').on(t.sessionId), unique('cash_movements_property_reference_unique').on(t.propertyId, t.referenceId),
]);

export const cashCounts = pgTable('cash_counts', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  countedAmount: numeric('counted_amount', { precision: 14, scale: 2 }).notNull(),
  expectedAmount: numeric('expected_amount', { precision: 14, scale: 2 }).notNull(),
  difference: numeric('difference', { precision: 14, scale: 2 }).notNull(),
  note: varchar('note', { length: 500 }),
  countedByAccountId: uuid('counted_by_account_id').notNull(),
  countedBy: varchar('counted_by', { length: 120 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'cash_counts_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'cash_counts_session_id_fkey', columns: [t.sessionId], foreignColumns: [cashSessions.id] }).onDelete('cascade'),
  foreignKey({ name: 'cash_counts_account_property_fkey', columns: [t.countedByAccountId, t.propertyId], foreignColumns: [accounts.id, accounts.propertyId] }).onDelete('restrict'),
  index('cash_counts_session_created_idx').on(t.sessionId, t.createdAt),
]);

export const cashCommands = pgTable('cash_commands', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  operation: varchar('operation', { length: 48 }).notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  response: jsonb().$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'cash_commands_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  unique('cash_commands_property_operation_key_unique').on(t.propertyId, t.operation, t.idempotencyKey),
]);
