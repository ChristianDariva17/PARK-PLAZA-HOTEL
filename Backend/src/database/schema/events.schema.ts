import { relations, sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './security.schema.js';
import { properties } from './hotel.schema.js';
import { guests } from './guests.schema.js';
import { customerAccounts } from './customer.schema.js';

export const eventStatusEnum = pgEnum('event_status', ['draft', 'tentative', 'confirmed', 'preparing', 'in_progress', 'cancelled', 'completed', 'archived']);
export const eventTimeKindEnum = pgEnum('event_time_kind', ['full_day', 'time_bound', 'multi_day']);
export const exceptionKindEnum = pgEnum('event_exception_kind', ['cancelled', 'modified']);
export const eventLegacyPartyEnum = pgEnum('event_legacy_party', ['guest', 'customerAccount', 'both', 'neither']);
export const eventQuarantineStatusEnum = pgEnum('event_quarantine_status', ['pending', 'resolved']);

export const eventSpaces = pgTable('event_spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  capacity: integer('capacity'),
  openingTime: varchar('opening_time', { length: 5 }).default('08:00'),
  closingTime: varchar('closing_time', { length: 5 }).default('22:00'),
  setupMinutes: integer('setup_minutes').notNull().default(0),
  teardownMinutes: integer('teardown_minutes').notNull().default(0),
  minimumDurationMinutes: integer('minimum_duration_minutes').notNull().default(60),
  baseRate: numeric('base_rate', { precision: 12, scale: 2 }).notNull().default('0'),
  includedMinutes: integer('included_minutes').notNull().default(60),
  extraMinuteRate: numeric('extra_minute_rate', { precision: 12, scale: 2 }).notNull().default('0'),
  depositPercentage: numeric('deposit_percentage', { precision: 5, scale: 2 }).notNull().default('0'),
  guaranteeAmount: numeric('guarantee_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  cleaningFee: numeric('cleaning_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  rules: jsonb('rules').notNull().default({}),
  cancellationPolicy: jsonb('cancellation_policy').notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_event_spaces_property_code').on(table.propertyId, table.code),
]);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  spaceId: uuid('space_id').notNull().references(() => eventSpaces.id),
  // Can link to an internal guest or an external customer
  guestId: uuid('guest_id').references(() => guests.id),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id),
  legacyPartyType: eventLegacyPartyEnum('legacy_party_type'),
  quarantineStatus: eventQuarantineStatusEnum('quarantine_status').notNull().default('resolved'),
  quarantineResolvedAt: timestamp('quarantine_resolved_at', { withTimezone: true }),
  quarantineResolvedByAccountId: uuid('quarantine_resolved_by_account_id').references(() => accounts.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }),
  status: eventStatusEnum('status').notNull().default('draft'),
  timeKind: eventTimeKindEnum('time_kind').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  eventStartsAt: timestamp('event_starts_at', { withTimezone: true }),
  eventEndsAt: timestamp('event_ends_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  attendees: integer('attendees').notNull().default(1),
  estimatedAmount: numeric('estimated_amount', { precision: 12, scale: 2 }), // Required later for contract/cash
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }),
  depositReceivedAmount: numeric('deposit_received_amount', { precision: 12, scale: 2 }),
  balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }),
  guaranteeAmount: numeric('guarantee_amount', { precision: 12, scale: 2 }),
  pricingSnapshot: jsonb('pricing_snapshot'),
  policySnapshot: jsonb('policy_snapshot'),
  version: integer('version').notNull().default(1),
  createdByAccountId: uuid('created_by_account_id').references(() => accounts.id),
  createdByCustomerAccountId: uuid('created_by_customer_account_id').references(() => customerAccounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledByAccountId: uuid('cancelled_by_account_id').references(() => accounts.id),
  cancellationReason: varchar('cancellation_reason', { length: 500 }),
}, (table) => [
  index('idx_events_property_dates').on(table.propertyId, table.startsAt, table.endsAt),
  index('idx_events_property_space').on(table.propertyId, table.spaceId),
  index('idx_events_active_interval').on(table.propertyId, table.spaceId, table.startsAt, table.endsAt),
  check('chk_canonical_party', sql`quarantine_status = 'pending' OR ( (guest_id IS NOT NULL AND customer_account_id IS NULL) OR (guest_id IS NULL AND customer_account_id IS NOT NULL) )`),
]);

export const eventServices = pgTable('event_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  eventId: uuid('event_id').notNull().references(() => events.id),
  serviceCode: varchar('service_code', { length: 64 }).notNull(), // e.g., catering, projector
  quantity: integer('quantity'),
  unitAmount: numeric('unit_amount', { precision: 12, scale: 2 }),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }),
  notes: varchar('notes', { length: 500 }),
});

export const eventSpaceServices = pgTable('event_space_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  spaceId: uuid('space_id').notNull().references(() => eventSpaces.id),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  unitAmount: numeric('unit_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  active: boolean('active').notNull().default(true),
}, (table) => [
  uniqueIndex('idx_event_space_services_code').on(table.spaceId, table.code),
]);

export const eventRecurrence = pgTable('event_recurrence', {
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  eventId: uuid('event_id').primaryKey().references(() => events.id), // 1:1 relation to the master event
  rrule: varchar('rrule', { length: 500 }).notNull(),
  seriesTimezone: varchar('series_timezone', { length: 64 }).notNull(),
  until: timestamp('until', { withTimezone: true }),
  count: integer('count'),
});

export const eventOccurrenceExceptions = pgTable('event_occurrence_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  eventId: uuid('event_id').notNull().references(() => events.id),
  occurrenceStartAt: timestamp('occurrence_start_at', { withTimezone: true }).notNull(),
  kind: exceptionKindEnum('kind').notNull(),
  overrideStartsAt: timestamp('override_starts_at', { withTimezone: true }),
  overrideEndsAt: timestamp('override_ends_at', { withTimezone: true }),
  overrideSpaceId: uuid('override_space_id').references(() => eventSpaces.id),
  overridePayload: jsonb('override_payload'),
}, (table) => [
  uniqueIndex('idx_event_exceptions_occurrence').on(table.eventId, table.occurrenceStartAt),
]);

export const eventCommands = pgTable('event_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  eventId: uuid('event_id').references(() => events.id),
  operation: varchar('operation', { length: 64 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 255 }).notNull(),
  response: jsonb('response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_event_commands_idempotency').on(table.propertyId, table.idempotencyKey),
]);

export const eventSpacesRelations = relations(eventSpaces, ({ one, many }) => ({
  property: one(properties, { fields: [eventSpaces.propertyId], references: [properties.id] }),
  events: many(events),
  spaceServices: many(eventSpaceServices),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  property: one(properties, { fields: [events.propertyId], references: [properties.id] }),
  space: one(eventSpaces, { fields: [events.spaceId], references: [eventSpaces.id] }),
  guest: one(guests, { fields: [events.guestId], references: [guests.id] }),
  customer: one(customerAccounts, { fields: [events.customerAccountId], references: [customerAccounts.id] }),
  createdBy: one(accounts, { fields: [events.createdByAccountId], references: [accounts.id] }),
  cancelledBy: one(accounts, { fields: [events.cancelledByAccountId], references: [accounts.id] }),
  services: many(eventServices),
  recurrence: one(eventRecurrence, { fields: [events.id], references: [eventRecurrence.eventId] }),
  exceptions: many(eventOccurrenceExceptions),
}));

export const eventServicesRelations = relations(eventServices, ({ one }) => ({
  event: one(events, { fields: [eventServices.eventId], references: [events.id] }),
  property: one(properties, { fields: [eventServices.propertyId], references: [properties.id] }),
}));

export const eventRecurrenceRelations = relations(eventRecurrence, ({ one }) => ({
  event: one(events, { fields: [eventRecurrence.eventId], references: [events.id] }),
  property: one(properties, { fields: [eventRecurrence.propertyId], references: [properties.id] }),
}));

export const eventOccurrenceExceptionsRelations = relations(eventOccurrenceExceptions, ({ one }) => ({
  event: one(events, { fields: [eventOccurrenceExceptions.eventId], references: [events.id] }),
  property: one(properties, { fields: [eventOccurrenceExceptions.propertyId], references: [properties.id] }),
  overrideSpace: one(eventSpaces, { fields: [eventOccurrenceExceptions.overrideSpaceId], references: [eventSpaces.id] }),
}));

export const eventSpaceServicesRelations = relations(eventSpaceServices, ({ one }) => ({
  space: one(eventSpaces, { fields: [eventSpaceServices.spaceId], references: [eventSpaces.id] }),
  property: one(properties, { fields: [eventSpaceServices.propertyId], references: [properties.id] }),
}));

