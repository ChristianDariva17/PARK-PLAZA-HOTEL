import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties, rooms } from './hotel.schema.js';

export const cleaningTaskStatus = pgEnum('cleaning_task_status', ['pending', 'in_progress', 'completed', 'approved']);

export const cleaningTasks = pgTable('cleaning_tasks', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  roomId: uuid('room_id').notNull(),
  status: cleaningTaskStatus().notNull().default('pending'),
  assignedTo: varchar('assigned_to', { length: 100 }).notNull().default('Por asignar'),
  reason: varchar('reason', { length: 255 }).notNull().default('Check-out completado'),
  observation: text('observation'),
  evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'cleaning_tasks_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'cleaning_tasks_room_property_fkey', columns: [t.roomId, t.propertyId], foreignColumns: [rooms.id, rooms.propertyId] }).onDelete('restrict'),
  index('cleaning_tasks_property_status_idx').on(t.propertyId, t.status),
  index('cleaning_tasks_room_idx').on(t.roomId),
]);

export const cleaningCommands = pgTable('cleaning_commands', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  operation: varchar({ length: 64 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  response: jsonb().$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('cleaning_commands_key_idx').on(t.propertyId, t.operation, t.idempotencyKey),
]);
