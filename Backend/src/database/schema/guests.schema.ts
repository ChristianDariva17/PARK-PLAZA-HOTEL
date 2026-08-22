import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, pgEnum, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';

export const guestStatus = pgEnum('guest_status', ['active', 'archived']);
export const documentType = pgEnum('identity_document_type', ['dni', 'passport', 'foreign_id', 'other']);

export const guests = pgTable('guests', {
  id: uuid().defaultRandom().primaryKey(), propertyId: uuid('property_id').notNull(), firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(), birthDate: date('birth_date'), nationality: varchar({ length: 2 }),
  email: varchar({ length: 254 }), phone: varchar({ length: 32 }), status: guestStatus().notNull().default('active'),
  address: varchar({ length: 500 }), emergencyContact: varchar('emergency_contact', { length: 255 }), notes: varchar({ length: 2000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'guests_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  unique('guests_id_property_id_unique').on(t.id, t.propertyId),
  check('guests_nationality_check', sql`${t.nationality} IS NULL OR ${t.nationality} ~ '^[A-Z]{2}$'`),
  index('guests_property_name_idx').on(t.propertyId, t.lastName, t.firstName, t.id),
]);

export const identityDocuments = pgTable('identity_documents', {
  id: uuid().defaultRandom().primaryKey(), guestId: uuid('guest_id').notNull(), propertyId: uuid('property_id').notNull(),
  type: documentType().notNull(), issuingCountry: varchar('issuing_country', { length: 2 }).notNull(),
  documentNumber: varchar('document_number', { length: 64 }).notNull(), expiresOn: date('expires_on'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'identity_documents_guest_property_fkey', columns: [t.guestId, t.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('cascade'),
  unique('identity_documents_property_document_unique').on(t.propertyId, t.type, t.issuingCountry, t.documentNumber),
  uniqueIndex('identity_documents_one_primary_idx').on(t.guestId).where(sql`${t.isPrimary}`),
  check('identity_documents_country_check', sql`${t.issuingCountry} ~ '^[A-Z]{2}$'`),
  index('identity_documents_guest_idx').on(t.guestId),
]);
