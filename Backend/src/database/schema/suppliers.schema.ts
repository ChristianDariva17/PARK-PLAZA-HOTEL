import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { properties } from './hotel.schema.js';
import { customerAccounts } from './customer.schema.js';

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    
    // Identity
    legalName: text('legal_name').notNull(),
    legalNameNormalized: text('legal_name_normalized').notNull(),
    taxId: varchar('tax_id', { length: 50 }).notNull(),
    taxIdNormalized: varchar('tax_id_normalized', { length: 50 }).notNull(),
    tradeName: text('trade_name'),
    
    // Contact
    contactName: text('contact_name'),
    phone: varchar('phone', { length: 50 }),
    email: text('email'),
    
    // Operations & SLA
    categories: text('categories').array(),
    averageDeliveryDays: integer('average_delivery_days').default(0),
    isPreferred: boolean('is_preferred').default(false).notNull(),
    rating: integer('rating').default(5),
    ratingNotes: text('rating_notes'),
    
    // System
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, archived
    version: integer('version').notNull().default(1),
    
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    archivedAt: timestamp('archived_at'),
    archivedByAccountId: uuid('archived_by_account_id').references(() => customerAccounts.id),
  },
  (table) => ({
    // Unique compound constraint required for isolation and relationships
    propertyIsolationUnique: uniqueIndex('idx_suppliers_property_isolation').on(
      table.id,
      table.propertyId,
    ),
    
    // Deduplication rule for active suppliers in the same property
    activeTaxIdUnique: uniqueIndex('idx_suppliers_tax_id_active')
      .on(table.propertyId, table.taxIdNormalized)
      .where(sql`status = 'active'`),
      
    // Read performance
    listIdx: index('idx_suppliers_list').on(table.propertyId, table.status, table.legalNameNormalized),
  }),
);

export const supplierBankDetails = pgTable(
  'supplier_bank_details',
  {
    supplierId: uuid('supplier_id').primaryKey().references(() => suppliers.id),
    propertyId: uuid('property_id').notNull().references(() => properties.id),
    
    bankName: text('bank_name'),
    accountType: varchar('account_type', { length: 50 }),
    accountHolder: text('account_holder'),
    maskedAccountNumber: varchar('masked_account_number', { length: 10 }),
    
    // Encrypted payload for full account details (disabled currently)
    encryptedPayload: text('encrypted_payload'),
    
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    orderNumber: varchar('order_number', { length: 40 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('draft'), // draft, sent, received, cancelled
    expectedDeliveryDate: timestamp('expected_delivery_date'),
    currency: varchar('currency', { length: 3 }).notNull().default('PEN'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    items: jsonb('items').notNull().default([]), // [{ inventoryItemId, name, unit, quantity, unitCost, totalCost }]
    notes: text('notes'),
    invoiceNumber: varchar('invoice_number', { length: 80 }),
    rating: integer('rating'),
    ratingNotes: text('rating_notes'),
    issuedByAccountId: uuid('issued_by_account_id'),
    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    propertyIsolationUnique: uniqueIndex('idx_purchase_orders_property_isolation').on(
      table.id,
      table.propertyId,
    ),
    supplierIdx: index('idx_purchase_orders_supplier').on(table.propertyId, table.supplierId),
    statusIdx: index('idx_purchase_orders_status').on(table.propertyId, table.status),
  })
);

export const supplierCommands = pgTable(
  'supplier_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    operation: varchar('operation', { length: 50 }).notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    
    responseStatus: integer('response_status'),
    response: text('response'),
    
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueKey: uniqueIndex('idx_supplier_commands_unique').on(
      table.propertyId,
      table.operation,
      table.idempotencyKey,
    ),
  }),
);
