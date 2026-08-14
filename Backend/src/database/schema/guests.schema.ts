import { sql } from 'drizzle-orm';
import { check, date, index, pgEnum, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const guestStatus = pgEnum('guest_status', ['active', 'archived']);
export const documentType = pgEnum('identity_document_type', ['dni', 'passport', 'foreign_id', 'other']);

export const guests = pgTable('guests', {
  id: uuid().defaultRandom().primaryKey(), firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(), birthDate: date('birth_date'), nationality: varchar({ length: 2 }),
  email: varchar({ length: 254 }), phone: varchar({ length: 32 }), status: guestStatus().notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [check('guests_nationality_check', sql`${t.nationality} IS NULL OR ${t.nationality} ~ '^[A-Z]{2}$'`), index('guests_name_idx').on(t.lastName, t.firstName)]);

export const identityDocuments = pgTable('identity_documents', {
  id: uuid().defaultRandom().primaryKey(), guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  type: documentType().notNull(), issuingCountry: varchar('issuing_country', { length: 2 }).notNull(),
  documentNumber: varchar('document_number', { length: 64 }).notNull(), expiresOn: date('expires_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.type, t.issuingCountry, t.documentNumber), check('identity_documents_country_check', sql`${t.issuingCountry} ~ '^[A-Z]{2}$'`), index('identity_documents_guest_idx').on(t.guestId)]);
