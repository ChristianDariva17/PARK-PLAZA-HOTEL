import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, numeric, pgEnum, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties, rooms } from './hotel.schema.js';

export const ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;
export const reservationStatus = pgEnum('reservation_status', [...ACTIVE_RESERVATION_STATUSES, 'completed', 'cancelled', 'no_show', 'expired']);

export const reservations = pgTable('reservations', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  roomId: uuid('room_id').notNull(),
  primaryGuestId: uuid('primary_guest_id').notNull().references(() => guests.id, { onDelete: 'restrict' }),
  status: reservationStatus().notNull().default('pending'), checkIn: date('check_in').notNull(), checkOut: date('check_out').notNull(),
  guestCount: integer('guest_count').notNull(), nightlyRate: numeric('nightly_rate', { precision: 14, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [foreignKey({ columns: [t.roomId, t.propertyId], foreignColumns: [rooms.id, rooms.propertyId] }).onDelete('restrict'), check('reservations_dates_check', sql`${t.checkOut} > ${t.checkIn}`), check('reservations_guest_count_check', sql`${t.guestCount} > 0`), check('reservations_money_check', sql`${t.nightlyRate} >= 0 AND ${t.totalAmount} >= 0`), index('reservations_room_dates_idx').on(t.roomId, t.checkIn, t.checkOut), index('reservations_primary_guest_idx').on(t.primaryGuestId)]);

export const reservationGuests = pgTable('reservation_guests', {
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'restrict' }),
  isPrimary: boolean('is_primary').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.reservationId, t.guestId] }), index('reservation_guests_guest_idx').on(t.guestId)]);
