import { boolean, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { accounts } from './security.schema.js';

export const communicationPreferences = pgTable('communication_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 50 }).notNull(), // EMAIL, SMS, WHATSAPP, INTERNAL
  purpose: varchar('purpose', { length: 50 }).notNull(), // PROMOTIONAL, TRANSACTIONAL, ALERTS
  optIn: boolean('opt_in').notNull().default(false),
  consentVersion: varchar('consent_version', { length: 20 }), // e.g., 'v1.0'
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  
  // Destination
  targetRole: varchar('target_role', { length: 50 }), // null means targetAccountId is used
  targetAccountId: uuid('target_account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  
  // Content
  type: varchar('type', { length: 50 }).notNull(), // ALARM, INFO, TASK
  title: varchar('title', { length: 150 }).notNull(),
  content: varchar('content', { length: 500 }).notNull(),
  actionLink: varchar('action_link', { length: 255 }), // e.g. /incidencias/123
  
  // Metadata & state
  metadata: jsonb('metadata').default({}).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
});
