import { boolean, integer, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { stays } from './stays.schema.js';
import { customerAccounts } from './customer.schema.js';

export const amenityReservations = pgTable('amenity_reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  stayId: uuid('stay_id').references(() => stays.id, { onDelete: 'restrict' }),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'restrict' }),
  amenityType: varchar('amenity_type', { length: 50 }).notNull(), // 'Piscina', 'Mirador', 'pool', 'mirador'
  documentNumber: varchar('document_number', { length: 32 }),
  customerName: varchar('customer_name', { length: 200 }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  pax: integer('pax').notNull().default(1),
  price: numeric('price', { precision: 14, scale: 2 }).notNull().default('0'),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'), // 'pending', 'open_tab', 'paid'
  status: varchar('status', { length: 20 }).notNull().default('confirmed'), // 'confirmed', 'checked_in', 'completed', 'cancelled'
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const amenityConfigs = pgTable('amenity_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  amenityKey: varchar('amenity_key', { length: 50 }).notNull(), // 'piscina', 'mirador'
  name: varchar('name', { length: 100 }).notNull(),
  priceExternal: numeric('price_external', { precision: 14, scale: 2 }).notNull().default('50.00'),
  priceGuest: numeric('price_guest', { precision: 14, scale: 2 }).notNull().default('0.00'),
  durationMinutes: integer('duration_minutes').notNull().default(120),
  maxPax: integer('max_pax').notNull().default(6),
  capacity: integer('capacity').notNull().default(24),
  openingHour: varchar('opening_hour', { length: 10 }).notNull().default('08:00'),
  closingHour: varchar('closing_hour', { length: 10 }).notNull().default('20:00'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const amenityBlocks = pgTable('amenity_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  amenityKey: varchar('amenity_key', { length: 50 }).notNull(),
  reason: varchar('reason', { length: 250 }).notNull(), // 'Mantenimiento de filtros', 'Evento privado'
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
