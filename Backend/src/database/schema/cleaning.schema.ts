import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties, rooms } from './hotel.schema.js';
import { stays } from './stays.schema.js';

export const cleaningTaskStatus = pgEnum('cleaning_task_status', ['pending', 'in_progress', 'completed', 'approved']);

export const cleaningTasks = pgTable('cleaning_tasks', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  roomId: uuid('room_id').notNull(),
  stayId: uuid('stay_id'),
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
  foreignKey({ name: 'cleaning_tasks_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('restrict'),
  index('cleaning_tasks_property_status_idx').on(t.propertyId, t.status),
  index('cleaning_tasks_room_idx').on(t.roomId),
  uniqueIndex('cleaning_tasks_stay_unique').on(t.stayId).where(sql`${t.stayId} IS NOT NULL`),
]);

export const cleaningCommands = pgTable('cleaning_commands', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  operation: varchar({ length: 64 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  response: jsonb().$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('cleaning_commands_key_unique').on(t.propertyId, t.operation, t.idempotencyKey),
]);
