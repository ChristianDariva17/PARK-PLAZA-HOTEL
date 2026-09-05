import { sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { accounts } from './security.schema.js';
import { reservations } from './reservations.schema.js';

export const contractStatus = pgEnum('contract_status', ['Borrador', 'Pendiente', 'Vigente', 'Reemplazado', 'Cancelado']);

export const contracts = pgTable('contracts', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
  reference: varchar({ length: 128 }).notNull(),
  status: contractStatus().notNull().default('Borrador'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('contracts_property_reference_unique').on(table.propertyId, table.reference),
]);

export const contractVersions = pgTable('contract_versions', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  contractId: uuid('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  versionNumber: varchar('version_number', { length: 32 }).notNull(),
  creatorAccountId: uuid('creator_account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  reason: varchar({ length: 255 }).notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('contract_versions_contract_number_unique').on(table.contractId, table.versionNumber),
  uniqueIndex('contract_versions_idempotency_unique').on(table.propertyId, table.idempotencyKey),
]);

export const evidences = pgTable('evidences', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  originType: varchar('origin_type', { length: 64 }).notNull(), // 'cleaning', 'maintenance', 'incident', 'contract'
  originId: uuid('origin_id').notNull(),
  description: varchar({ length: 255 }).notNull(),
  metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  creatorAccountId: uuid('creator_account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contractEvidenceLinks = pgTable('contract_evidence_links', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  contractId: uuid('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  evidenceId: uuid('evidence_id').notNull().references(() => evidences.id, { onDelete: 'cascade' }),
  relationType: varchar('relation_type', { length: 64 }).notNull(),
  linkedByAccountId: uuid('linked_by_account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('contract_evidence_links_unique').on(table.contractId, table.evidenceId),
]);
