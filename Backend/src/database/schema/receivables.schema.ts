import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, numeric, pgEnum, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties } from './hotel.schema.js';
import { reservations } from './reservations.schema.js';
import { folios, stays } from './stays.schema.js';

export const receivableStatus = pgEnum('receivable_status', ['open', 'settled']);

export const receivables = pgTable('receivables', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), stayId: uuid('stay_id').notNull(), reservationId: uuid('reservation_id').notNull(), primaryGuestId: uuid('primary_guest_id').notNull(), folioId: uuid('folio_id').notNull(),
  status: receivableStatus().notNull().default('open'), originalAmount: numeric('original_amount', { precision: 14, scale: 2 }).notNull(), outstandingAmount: numeric('outstanding_amount', { precision: 14, scale: 2 }).notNull(), reason: varchar({ length: 300 }).notNull(), openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(), settledAt: timestamp('settled_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'receivables_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'receivables_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'receivables_reservation_property_fkey', columns: [t.reservationId, t.propertyId], foreignColumns: [reservations.id, reservations.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'receivables_guest_property_fkey', columns: [t.primaryGuestId, t.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'receivables_folio_property_fkey', columns: [t.folioId, t.propertyId], foreignColumns: [folios.id, folios.propertyId] }).onDelete('restrict'),
  unique().on(t.stayId), unique().on(t.folioId), index('receivables_property_status_opened_idx').on(t.propertyId, t.status, t.openedAt),
  check('receivables_amounts_check', sql`${t.originalAmount} > 0 AND ${t.outstandingAmount} >= 0 AND ${t.outstandingAmount} <= ${t.originalAmount}`),
]);

export const receivableCommands = pgTable('receivable_commands', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), operation: varchar({ length: 48 }).notNull(), idempotencyKey: uuid('idempotency_key').notNull(), response: jsonb().$type<Record<string, unknown>>().notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [foreignKey({ name: 'receivable_commands_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'), unique().on(t.propertyId, t.operation, t.idempotencyKey)]);
