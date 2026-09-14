import { boolean, foreignKey, index, integer, numeric, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { stays } from './stays.schema.js';
import { accounts } from './security.schema.js';
import { guests } from './guests.schema.js';

export const experiences = pgTable('experiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 500 }),
  type: varchar('type', { length: 50 }).notNull(), // POOL, WELLNESS, TOUR, DINING, EVENT
  
  // Rules
  maxCapacity: integer('max_capacity'),
  requiresReservation: boolean('requires_reservation').notNull().default(false),
  price: numeric('price', { precision: 14, scale: 2 }).notNull().default('0'), // 0 = Included
  
  // Lifecycle
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'), // DRAFT, PUBLISHED, SUSPENDED, ARCHIVED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  publishedBy: uuid('published_by').references(() => accounts.id),
}, (table) => [
  unique('experiences_id_property_id_unique').on(table.id, table.propertyId),
  foreignKey({
    name: 'experiences_published_by_property_fkey',
    columns: [table.publishedBy, table.propertyId],
    foreignColumns: [accounts.id, accounts.propertyId],
  }).onDelete('restrict'),
]);

export const experienceParticipations = pgTable('experience_participations', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  experienceId: uuid('experience_id').notNull().references(() => experiences.id, { onDelete: 'restrict' }),
  
  // Link to stay or client
  stayId: uuid('stay_id').references(() => stays.id, { onDelete: 'restrict' }),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'restrict' }),
  
  pax: integer('pax').notNull().default(1),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  
  // Status (REQUESTED -> CONFIRMED -> ATTENDED | CANCELLED | NO_SHOW)
  status: varchar('status', { length: 20 }).notNull().default('REQUESTED'),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  
  // Audit
  idempotencyKey: uuid('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  registeredBy: uuid('registered_by').notNull().references(() => accounts.id),
}, (table) => [
  foreignKey({
    name: 'experience_participations_experience_property_fkey',
    columns: [table.experienceId, table.propertyId],
    foreignColumns: [experiences.id, experiences.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'experience_participations_stay_property_fkey',
    columns: [table.stayId, table.propertyId],
    foreignColumns: [stays.id, stays.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'experience_participations_guest_property_fkey',
    columns: [table.guestId, table.propertyId],
    foreignColumns: [guests.id, guests.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'experience_participations_registered_by_property_fkey',
    columns: [table.registeredBy, table.propertyId],
    foreignColumns: [accounts.id, accounts.propertyId],
  }).onDelete('restrict'),
  uniqueIndex('experience_participations_property_idempotency_unique').on(table.propertyId, table.idempotencyKey),
  index('experience_participations_slot_idx').on(table.propertyId, table.experienceId, table.scheduledAt),
]);
