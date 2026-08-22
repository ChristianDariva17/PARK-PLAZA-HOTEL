import { sql } from 'drizzle-orm';
import {
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  foreignKey,
  boolean
} from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties } from './hotel.schema.js';
import { stays } from './stays.schema.js';

export const petStatus = pgEnum('pet_status', ['Activa', 'Archivada']);

export const pets = pgTable('pets', {
  id: varchar('id', { length: 20 }).primaryKey(), // e.g. PET-...
  propertyId: uuid('property_id').notNull(),
  stayId: uuid('stay_id'), // can be null if not linked to active stay
  clientId: uuid('client_id').notNull(),

  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // Perro, Gato, etc
  size: varchar('size', { length: 50 }).notNull(), // Pequeño, Mediano, Grande
  lodgingPlace: varchar('lodging_place', { length: 100 }).notNull(), // Habitación, Cochera
  charge: numeric('charge', { precision: 14, scale: 2 }).notNull().default('0.00'),
  chargeId: varchar('charge_id', { length: 50 }),
  chargeApplied: boolean('charge_applied').notNull().default(false),
  notes: text('notes'),
  damageIncidentId: varchar('damage_incident_id', { length: 50 }),
  status: petStatus('status').notNull().default('Activa'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'),
  reactivatedAt: timestamp('reactivated_at', { withTimezone: true }),
  reactivationReason: text('reactivation_reason'),
}, (t) => [
  foreignKey({
    name: 'pets_property_id_fkey',
    columns: [t.propertyId],
    foreignColumns: [properties.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'pets_stay_fkey',
    columns: [t.stayId, t.propertyId],
    foreignColumns: [stays.id, stays.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'pets_client_fkey',
    columns: [t.clientId, t.propertyId],
    foreignColumns: [guests.id, guests.propertyId],
  }).onDelete('restrict'),
]);
