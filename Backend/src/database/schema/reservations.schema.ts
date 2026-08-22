import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, numeric, pgEnum, pgTable, primaryKey, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties, rooms } from './hotel.schema.js';

export const ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;
export const reservationStatus = pgEnum('reservation_status', [...ACTIVE_RESERVATION_STATUSES, 'completed', 'cancelled', 'no_show', 'expired']);

export const reservations = pgTable('reservations', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(),
  roomId: uuid('room_id').notNull(),
  primaryGuestId: uuid('primary_guest_id').notNull(),
  status: reservationStatus().notNull().default('pending'),
  // Civil dates are immutable compatibility shadows. UTC instants are authoritative.
  checkIn: date('check_in').notNull(), checkOut: date('check_out').notNull(),
  checkInAt: timestamp('check_in_at', { withTimezone: true }).notNull(),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }).notNull(),
  guestCount: integer('guest_count').notNull(), nightlyRate: numeric('nightly_rate', { precision: 14, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'reservations_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'reservations_room_id_property_id_fkey', columns: [t.roomId, t.propertyId], foreignColumns: [rooms.id, rooms.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'reservations_primary_guest_property_fkey', columns: [t.primaryGuestId, t.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('restrict'),
  unique('reservations_id_property_id_unique').on(t.id, t.propertyId),
  check('reservations_dates_check', sql`${t.checkOut} > ${t.checkIn}`),
  check('reservations_interval_check', sql`${t.checkOutAt} > ${t.checkInAt}`),
  check('reservations_guest_count_check', sql`${t.guestCount} > 0`),
  check('reservations_money_check', sql`${t.nightlyRate} >= 0 AND ${t.totalAmount} >= 0`),
  index('reservations_room_dates_idx').on(t.roomId, t.checkIn, t.checkOut),
  index('reservations_room_interval_idx').on(t.roomId, t.checkInAt, t.checkOutAt),
  index('reservations_primary_guest_idx').on(t.primaryGuestId),
]);

export const reservationGuests = pgTable('reservation_guests', {
  reservationId: uuid('reservation_id').notNull(),
  guestId: uuid('guest_id').notNull(),
  propertyId: uuid('property_id').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.reservationId, t.guestId] }),
  foreignKey({ name: 'reservation_guests_reservation_property_fkey', columns: [t.reservationId, t.propertyId], foreignColumns: [reservations.id, reservations.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'reservation_guests_guest_property_fkey', columns: [t.guestId, t.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('restrict'),
  index('reservation_guests_guest_idx').on(t.guestId),
  uniqueIndex('reservation_guests_one_primary_idx').on(t.reservationId).where(sql`${t.isPrimary}`),
]);
