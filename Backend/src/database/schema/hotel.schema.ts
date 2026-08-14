import { check, foreignKey, index, integer, numeric, pgEnum, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roomStatus = pgEnum('room_status', ['available', 'reserved', 'occupied', 'cleaning', 'maintenance', 'blocked', 'out_of_service']);

export const properties = pgTable('properties', {
  id: uuid().defaultRandom().primaryKey(), code: varchar({ length: 32 }).notNull().unique(),
  name: varchar({ length: 160 }).notNull(), timezone: varchar({ length: 64 }).notNull().default('America/Lima'),
  currency: varchar({ length: 3 }).notNull().default('PEN'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check('properties_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`)]);

export const roomCategories = pgTable('room_categories', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  code: varchar({ length: 32 }).notNull(), name: varchar({ length: 100 }).notNull(), capacity: integer().notNull(),
  baseNightlyRate: numeric('base_nightly_rate', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.propertyId, t.code), unique().on(t.id, t.propertyId), check('room_categories_capacity_check', sql`${t.capacity} > 0`), check('room_categories_rate_check', sql`${t.baseNightlyRate} >= 0`)]);

export const rooms = pgTable('rooms', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').notNull(), number: varchar({ length: 16 }).notNull(), floor: integer().notNull(),
  status: roomStatus().notNull().default('available'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.propertyId, t.number), unique().on(t.id, t.propertyId), foreignKey({ columns: [t.categoryId, t.propertyId], foreignColumns: [roomCategories.id, roomCategories.propertyId] }).onDelete('restrict'), index('rooms_category_idx').on(t.categoryId)]);
