import { boolean, integer, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
});

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
});
