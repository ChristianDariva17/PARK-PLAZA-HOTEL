import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { accounts, staff } from './security.schema.js';

export const attendanceMovement = pgEnum('attendance_movement', ['Ingreso', 'Salida']);
export const attendanceMethod = pgEnum('attendance_method', ['Biométrico', 'Manual', 'QR_GPS']);
export const attendanceStatus = pgEnum('attendance_status', ['Completado', 'Anomalía', 'Revisión Pendiente']);
export const attendanceCorrectionStatus = pgEnum('attendance_correction_status', ['Solicitado', 'Aprobado', 'Rechazado']);

export const staffProfiles = pgTable('staff_profiles', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  documentNormalized: varchar('document_normalized', { length: 32 }).notNull(),
  position: varchar({ length: 100 }),
  department: varchar({ length: 100 }),
  phone: varchar({ length: 32 }),
  email: varchar({ length: 254 }),
  status: varchar({ length: 32 }).notNull().default('Activo'), // Activo, Archivado
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('staff_profiles_document_unique').on(table.propertyId, table.documentNormalized).where(sql`${table.status} = 'Activo'`),
  index('staff_profiles_staff_idx').on(table.staffId),
]);

export const workSchedules = pgTable('work_schedules', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  name: varchar({ length: 100 }).notNull(),
  ianaTimezone: varchar('iana_timezone', { length: 64 }).notNull(),
  status: varchar({ length: 32 }).notNull().default('Activo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workScheduleAssignments = pgTable('work_schedule_assignments', {
  id: uuid().defaultRandom().primaryKey(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  workScheduleId: uuid('work_schedule_id').notNull().references(() => workSchedules.id, { onDelete: 'restrict' }),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  pattern: jsonb().$type<Record<string, unknown>>().notNull(), // to store weekly intervals
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shiftInstances = pgTable('shift_instances', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  plannedStartAt: timestamp('planned_start_at', { withTimezone: true }).notNull(),
  plannedEndAt: timestamp('planned_end_at', { withTimezone: true }).notNull(),
  ianaTimezone: varchar('iana_timezone', { length: 64 }).notNull(),
  status: varchar({ length: 32 }).notNull().default('Programado'), // Programado, Cancelado
  cancellationReason: varchar('cancellation_reason', { length: 255 }),
  origin: varchar({ length: 64 }).notNull().default('Generado'), // Generado, Manual
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('shift_instances_staff_time_idx').on(table.staffId, table.plannedStartAt),
]);

export const attendanceDevices = pgTable('attendance_devices', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  code: varchar({ length: 64 }).notNull(),
  name: varchar({ length: 100 }).notNull(),
  zone: varchar({ length: 100 }),
  status: varchar({ length: 32 }).notNull().default('Activo'),
  ianaTimezone: varchar('iana_timezone', { length: 64 }).notNull(),
  inventoryMetadata: jsonb('inventory_metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('attendance_devices_code_unique').on(table.propertyId, table.code),
]);

export const staffBiometricBindings = pgTable('staff_biometric_bindings', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => attendanceDevices.id, { onDelete: 'restrict' }),
  templateReference: varchar('template_reference', { length: 255 }).notNull(),
  status: varchar({ length: 32 }).notNull().default('Activo'), // Activo, Revocado
  version: integer().notNull().default(1),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('staff_biometric_bindings_active_unique').on(table.propertyId, table.staffId, table.deviceId).where(sql`${table.status} = 'Activo'`),
]);

export const attendanceEvents = pgTable('attendance_events', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  shiftInstanceId: uuid('shift_instance_id').references(() => shiftInstances.id, { onDelete: 'set null' }),
  movement: attendanceMovement().notNull(),
  method: attendanceMethod().notNull(),
  status: attendanceStatus().notNull().default('Completado'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  deviceId: uuid('device_id').references(() => attendanceDevices.id, { onDelete: 'set null' }),
  bridgeOperationId: varchar('bridge_operation_id', { length: 64 }),
  idempotencyKey: uuid('idempotency_key').notNull(),
  metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  uniqueIndex('attendance_events_idempotency_unique').on(table.propertyId, table.idempotencyKey),
  uniqueIndex('attendance_events_bridge_op_unique').on(table.bridgeOperationId).where(sql`${table.bridgeOperationId} IS NOT NULL`),
  index('attendance_events_staff_time_idx').on(table.staffId, table.occurredAt),
]);

export const attendanceCorrections = pgTable('attendance_corrections', {
  id: uuid().defaultRandom().primaryKey(),
  attendanceEventId: uuid('attendance_event_id').notNull().references(() => attendanceEvents.id, { onDelete: 'restrict' }),
  correctionType: varchar('correction_type', { length: 64 }).notNull(),
  proposedValues: jsonb('proposed_values').$type<Record<string, unknown>>().notNull(),
  reason: text().notNull(),
  requesterAccountId: uuid('requester_account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  approverAccountId: uuid('approver_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  status: attendanceCorrectionStatus().notNull().default('Solicitado'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});
