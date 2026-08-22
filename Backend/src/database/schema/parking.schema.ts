import { sql } from 'drizzle-orm';
import {
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  foreignKey
} from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties, rooms } from './hotel.schema.js';
import { stays } from './stays.schema.js';

export const vehicleStatus = pgEnum('vehicle_status', ['Dentro', 'Fuera', 'Archivado']);

export const vehicleRegistrations = pgTable('vehicle_registrations', {
  id: varchar('id', { length: 20 }).primaryKey(), // Using varchar to support 'VEH-...'
  propertyId: uuid('property_id').notNull(),
  stayId: uuid('stay_id').notNull(),
  clientId: uuid('client_id').notNull(),
  roomId: uuid('room_id').notNull(),

  plate: varchar('plate', { length: 20 }).notNull(),
  brandModel: varchar('brand_model', { length: 100 }),
  vehicleType: varchar('vehicle_type', { length: 50 }).notNull(),
  space: varchar('space', { length: 50 }).notNull(),
  fee: numeric('fee', { precision: 14, scale: 2 }).notNull().default('0.00'),
  status: vehicleStatus('status').notNull().default('Dentro'),

  entryAt: timestamp('entry_at', { withTimezone: true }).defaultNow().notNull(),
  exitAt: timestamp('exit_at', { withTimezone: true }),
  entryResponsible: varchar('entry_responsible', { length: 100 }).notNull(),
  exitResponsible: varchar('exit_responsible', { length: 100 }),
  exitObservation: text('exit_observation'),

  chargeId: varchar('charge_id', { length: 50 }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({
    name: 'vehicles_property_id_fkey',
    columns: [t.propertyId],
    foreignColumns: [properties.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'vehicles_stay_fkey',
    columns: [t.stayId, t.propertyId],
    foreignColumns: [stays.id, stays.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'vehicles_client_fkey',
    columns: [t.clientId, t.propertyId],
    foreignColumns: [guests.id, guests.propertyId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'vehicles_room_fkey',
    columns: [t.roomId, t.propertyId],
    foreignColumns: [rooms.id, rooms.propertyId],
  }).onDelete('restrict'),
]);
