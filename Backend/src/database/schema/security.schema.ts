import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';

export const accountStatus = pgEnum('account_status', ['active', 'disabled']);
export const loginAttemptKind = pgEnum('login_attempt_kind', ['ip', 'account']);

export const roles = pgTable('roles', {
  id: uuid().defaultRandom().primaryKey(),
  key: varchar({ length: 64 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid().defaultRandom().primaryKey(),
  key: varchar({ length: 100 }).notNull().unique(),
  description: varchar({ length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check('permissions_key_check', sql`${table.key} ~ '^[a-z][a-z0-9_]*[.][a-z][a-z0-9_]*$'`)]);

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const accounts = pgTable('accounts', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
  email: varchar({ length: 254 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordChangeRequired: boolean('password_change_required').notNull().default(false),
  status: accountStatus().notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('accounts_email_unique').on(table.email),
  unique().on(table.id, table.propertyId),
  index('accounts_property_idx').on(table.propertyId),
  check('accounts_email_normalized_check', sql`${table.email} = lower(btrim(${table.email}))`),
]);

export const staff = pgTable('staff', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'restrict' }),
  accountId: uuid('account_id').unique('staff_account_id_key'),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('staff_property_idx').on(table.propertyId),
  foreignKey({ columns: [table.accountId, table.propertyId], foreignColumns: [accounts.id, accounts.propertyId] }).onDelete('restrict'),
]);

export const sessions = pgTable('sessions', {
  id: uuid().defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: varchar('revocation_reason', { length: 32 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
}, (table) => [
  uniqueIndex('sessions_one_active_per_account').on(table.accountId).where(sql`${table.revokedAt} IS NULL`),
  index('sessions_token_lookup_idx').on(table.tokenHash),
]);

export const recoveryTokens = pgTable('recovery_tokens', {
  id: uuid().defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}, (table) => [index('recovery_tokens_account_idx').on(table.accountId)]);

export const loginAttempts = pgTable('login_attempts', {
  kind: loginAttemptKind().notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  failureCount: integer('failure_count').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.kind, table.keyHash] }), check('login_attempts_failure_count_check', sql`${table.failureCount} >= 0`)]);

export const auditEvents = pgTable('audit_events', {
  id: uuid().defaultRandom().primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  requestId: varchar('request_id', { length: 128 }),
  actorAccountId: uuid('actor_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  subjectType: varchar('subject_type', { length: 64 }),
  subjectId: varchar('subject_id', { length: 128 }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
  metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [index('audit_events_actor_time_idx').on(table.actorAccountId, table.occurredAt), index('audit_events_event_time_idx').on(table.eventType, table.occurredAt)]);
