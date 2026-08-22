import { foreignKey, index, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';

export const cashSessions = pgTable('cash_sessions', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
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
  method: varchar('method', { length: 30 }).notNull(), // 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Yape' | 'Plin'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  responsible: varchar('responsible', { length: 120 }).notNull(),
}, (t) => [
  foreignKey({ name: 'cash_movements_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'cash_movements_session_id_fkey', columns: [t.sessionId], foreignColumns: [cashSessions.id] }).onDelete('cascade'),
  index('cash_movements_session_id_idx').on(t.sessionId),
]);
