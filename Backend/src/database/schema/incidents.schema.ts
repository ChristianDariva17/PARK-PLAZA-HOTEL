import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties, rooms } from './hotel.schema.js';

export const incidentType = pgEnum('incident_type', ['cleaning', 'maintenance']);
export const incidentPriority = pgEnum('incident_priority', ['low', 'medium', 'high', 'urgent']);
export const incidentStatus = pgEnum('incident_status', ['pending', 'assigned', 'in_progress', 'resolved', 'closed']);

export const incidents = pgTable('incidents', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  roomId: uuid('room_id'),
  type: incidentType().notNull().default('cleaning'),
  referenceId: uuid('reference_id'),
  description: text('description').notNull(),
  priority: incidentPriority().notNull().default('medium'),
  responsible: varchar('responsible', { length: 100 }).notNull().default('Por asignar'),
  status: incidentStatus().notNull().default('pending'),
  blocksRoom: boolean('blocks_room').notNull().default(false),
  evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
  solution: text('solution').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'incidents_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'incidents_room_property_fkey', columns: [t.roomId, t.propertyId], foreignColumns: [rooms.id, rooms.propertyId] }).onDelete('restrict'),
  index('incidents_property_status_idx').on(t.propertyId, t.status),
  index('incidents_room_idx').on(t.roomId),
]);
