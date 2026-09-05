import { sql } from 'drizzle-orm';
import {
  boolean,
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
  stayId: uuid('stay_id'),
  clientId: uuid('client_id'),
  roomId: uuid('room_id'),

  originType: varchar('origin_type', { length: 30 }).notNull().default('stay'),
  driverName: varchar('driver_name', { length: 150 }),
  driverPhone: varchar('driver_phone', { length: 50 }),
  vehicleColor: varchar('vehicle_color', { length: 50 }),
  keysLeft: boolean('keys_left').notNull().default(false),
  entryNotes: text('entry_notes'),

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
