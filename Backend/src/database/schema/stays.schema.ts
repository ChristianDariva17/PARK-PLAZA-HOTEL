import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, jsonb, numeric, pgEnum, pgTable, primaryKey, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties, rooms } from './hotel.schema.js';
import { reservations } from './reservations.schema.js';

export const stayStatus = pgEnum('stay_status', ['active', 'checked_out']);
export const folioEntryType = pgEnum('folio_entry_type', ['charge', 'payment', 'reversal']);
export const folioSettlement = pgEnum('folio_settlement', ['open', 'settled', 'receivable']);

export const stays = pgTable('stays', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), reservationId: uuid('reservation_id').notNull(), roomId: uuid('room_id').notNull(),
  status: stayStatus().notNull().default('active'), settlement: folioSettlement().notNull().default('open'), receivableReason: varchar('receivable_reason', { length: 300 }), receivableAmount: numeric('receivable_amount', { precision: 14, scale: 2 }), checkInAt: timestamp('check_in_at', { withTimezone: true }).notNull(), checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'stays_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'stays_reservation_property_fkey', columns: [t.reservationId, t.propertyId], foreignColumns: [reservations.id, reservations.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'stays_room_property_fkey', columns: [t.roomId, t.propertyId], foreignColumns: [rooms.id, rooms.propertyId] }).onDelete('restrict'),
  unique('stays_id_property_id_unique').on(t.id, t.propertyId),
  uniqueIndex('stays_one_active_per_reservation_idx').on(t.reservationId).where(sql`${t.status} = 'active'`),
  uniqueIndex('stays_one_active_per_room_idx').on(t.roomId).where(sql`${t.status} = 'active'`),
  check('stays_checkout_state_check', sql`(${t.status} = 'active' AND ${t.checkOutAt} IS NULL) OR (${t.status} = 'checked_out' AND ${t.checkOutAt} IS NOT NULL)`),
]);

export const stayGuests = pgTable('stay_guests', {
  stayId: uuid('stay_id').notNull(), guestId: uuid('guest_id').notNull(), propertyId: uuid('property_id').notNull(), isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.stayId, t.guestId] }),
  foreignKey({ name: 'stay_guests_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'stay_guests_guest_property_fkey', columns: [t.guestId, t.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('restrict'),
  uniqueIndex('stay_guests_one_primary_idx').on(t.stayId).where(sql`${t.isPrimary}`),
]);

export const folios = pgTable('folios', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), stayId: uuid('stay_id').notNull(),
  openingBalance: numeric('opening_balance', { precision: 14, scale: 2 }).notNull().default('0.00'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.stayId), unique('folios_id_property_id_unique').on(t.id, t.propertyId),
  foreignKey({ name: 'folios_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('cascade'),
  check('folios_zero_opening_balance_check', sql`${t.openingBalance} = 0`),
]);

export const folioEntries = pgTable('folio_entries', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), folioId: uuid('folio_id').notNull(), stayId: uuid('stay_id').notNull(),
  type: folioEntryType().notNull(), amount: numeric('amount', { precision: 14, scale: 2 }).notNull(), paymentMethod: varchar('payment_method', { length: 20 }),
  sourceType: varchar('source_type', { length: 48 }).notNull(), sourceId: varchar('source_id', { length: 64 }).notNull(), idempotencyKey: uuid('idempotency_key').notNull(), reversalOfEntryId: uuid('reversal_of_entry_id'), reason: varchar('reason', { length: 300 }), actorAccountId: uuid('actor_account_id').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'folio_entries_folio_property_fkey', columns: [t.folioId, t.propertyId], foreignColumns: [folios.id, folios.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'folio_entries_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'folio_entries_reversal_fkey', columns: [t.reversalOfEntryId], foreignColumns: [t.id] }).onDelete('restrict'),
  check('folio_entries_amount_check', sql`${t.amount} > 0`),
  check('folio_entries_payment_method_check', sql`${t.paymentMethod} IS NULL OR ${t.paymentMethod} IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin')`),
  unique('folio_entries_property_source_unique').on(t.propertyId, t.sourceType, t.sourceId),
  unique('folio_entries_property_idempotency_unique').on(t.propertyId, t.idempotencyKey),
  uniqueIndex('folio_entries_one_reversal_idx').on(t.reversalOfEntryId).where(sql`${t.reversalOfEntryId} IS NOT NULL`), index('folio_entries_stay_created_idx').on(t.stayId, t.createdAt),
]);

export const stayCommands = pgTable('stay_commands', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), operation: varchar({ length: 48 }).notNull(), idempotencyKey: uuid('idempotency_key').notNull(),
  response: jsonb().$type<Record<string, unknown>>().notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'stay_commands_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  unique().on(t.propertyId, t.operation, t.idempotencyKey), index('stay_commands_property_created_idx').on(t.propertyId, t.createdAt),
]);
