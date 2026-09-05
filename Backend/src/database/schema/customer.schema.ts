import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgEnum, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { guests } from './guests.schema.js';
import { properties } from './hotel.schema.js';
import { reservations } from './reservations.schema.js';
import { orders } from './restaurant.schema.js';

export const customerAccountStatus = pgEnum('customer_account_status', ['active', 'disabled']);

export const customerAccounts = pgTable('customer_accounts', {
  id: uuid().defaultRandom().primaryKey(),
  firebaseSubject: varchar('firebase_subject', { length: 128 }).notNull(),
  email: varchar({ length: 254 }).notNull(),
  displayName: varchar('display_name', { length: 200 }),
  photoUrl: varchar('photo_url', { length: 2048 }),
  status: customerAccountStatus().notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('customer_accounts_firebase_subject_unique').on(table.firebaseSubject),
  index('customer_accounts_email_idx').on(table.email),
]);

export const customerSessions = pgTable('customer_sessions', {
  id: uuid().defaultRandom().primaryKey(),
  customerAccountId: uuid('customer_account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: varchar('revocation_reason', { length: 32 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
}, (table) => [
  unique('customer_sessions_token_hash_unique').on(table.tokenHash),
  uniqueIndex('customer_sessions_one_active_per_account').on(table.customerAccountId).where(sql`${table.revokedAt} IS NULL`),
  index('customer_sessions_token_lookup_idx').on(table.tokenHash),
]);

export const customerGuestIdentities = pgTable('customer_guest_identities', {
  customerAccountId: uuid('customer_account_id').primaryKey().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').notNull(),
  propertyId: uuid('property_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'customer_guest_identities_guest_property_fkey', columns: [table.guestId, table.propertyId], foreignColumns: [guests.id, guests.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'customer_guest_identities_property_fkey', columns: [table.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  unique('customer_guest_identities_guest_property_unique').on(table.guestId, table.propertyId),
]);

export const customerReservations = pgTable('customer_reservations', {
  reservationId: uuid('reservation_id').primaryKey(),
  propertyId: uuid('property_id').notNull(),
  customerAccountId: uuid('customer_account_id').notNull().references(() => customerAccounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'customer_reservations_reservation_property_fkey', columns: [table.reservationId, table.propertyId], foreignColumns: [reservations.id, reservations.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'customer_reservations_property_fkey', columns: [table.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  index('customer_reservations_owner_idx').on(table.customerAccountId, table.createdAt),
]);

export const customerOrders = pgTable('customer_orders', {
  orderId: uuid('order_id').primaryKey(),
  propertyId: uuid('property_id').notNull(),
  customerAccountId: uuid('customer_account_id').notNull().references(() => customerAccounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'customer_orders_order_property_fkey', columns: [table.orderId, table.propertyId], foreignColumns: [orders.id, orders.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'customer_orders_property_fkey', columns: [table.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  index('customer_orders_owner_idx').on(table.customerAccountId, table.createdAt),
]);

export type CustomerReservationTransport = {
  id: string; status: typeof reservations.$inferSelect.status; checkInAt: string; checkOutAt: string; guestCount: number;
  nightlyRate: string; totalAmount: string; currency: string; createdAt: string;
  category: { code: string; name: string }; primaryGuest: { firstName: string; lastName: string };
};

export const customerReservationCommands = pgTable('customer_reservation_commands', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  customerAccountId: uuid('customer_account_id').notNull().references(() => customerAccounts.id, { onDelete: 'restrict' }),
  reservationId: uuid('reservation_id').notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  fingerprint: varchar({ length: 64 }).notNull(),
  response: jsonb().$type<CustomerReservationTransport>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'customer_reservation_commands_property_fkey', columns: [table.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'customer_reservation_commands_reservation_property_fkey', columns: [table.reservationId, table.propertyId], foreignColumns: [reservations.id, reservations.propertyId] }).onDelete('cascade'),
  unique('customer_reservation_commands_customer_key_unique').on(table.customerAccountId, table.idempotencyKey),
  index('customer_reservation_commands_reservation_idx').on(table.reservationId, table.createdAt),
]);

export type CustomerOrderTransport = {
  id: string; source: string; status: typeof orders.$inferSelect.status; stayId: string | null;
  total: string; estimatedMinutes: number; comment: string | null; deliveryMode: string | null; paymentMode: string | null; createdAt: string;
};

export type CustomerCommandReceipt = { status: number; body: Record<string, unknown> };

export const customerOrderCommands = pgTable('customer_order_commands', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  customerAccountId: uuid('customer_account_id').notNull().references(() => customerAccounts.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id').notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  fingerprint: varchar({ length: 64 }).notNull(),
  operation: varchar({ length: 24 }).notNull().default('create'),
  responseStatus: varchar('response_status', { length: 3 }).notNull().default('201'),
  response: jsonb().$type<CustomerCommandReceipt>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'customer_order_commands_property_fkey', columns: [table.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'customer_order_commands_order_property_fkey', columns: [table.orderId, table.propertyId], foreignColumns: [orders.id, orders.propertyId] }).onDelete('cascade'),
  unique('customer_order_commands_customer_operation_key_unique').on(table.customerAccountId, table.operation, table.idempotencyKey),
  index('customer_order_commands_order_idx').on(table.orderId, table.createdAt),
]);
