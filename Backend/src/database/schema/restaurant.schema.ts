import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { accounts } from './security.schema.js';
import { stays } from './stays.schema.js';
import { amenityReservations } from './amenities.schema.js';

// --- Import Runs de Menu ---
export const menuImportRuns = pgTable('menu_import_runs', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  actorAccountId: uuid('actor_account_id').notNull(),
  sourceSystem: varchar('source_system', { length: 80 }).notNull(),
  sourceDigest: varchar('source_digest', { length: 64 }).notNull(),
  mode: varchar({ length: 16 }).notNull(),
  status: varchar({ length: 20 }).notNull().default('running'),
  summary: jsonb().notNull().default({}),
  errorMessage: varchar('error_message', { length: 300 }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [
  unique('menu_import_runs_id_property_unique').on(t.id, t.propertyId),
  foreignKey({ name: 'menu_import_runs_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'menu_import_runs_actor_property_fkey', columns: [t.actorAccountId, t.propertyId], foreignColumns: [accounts.id, accounts.propertyId] }).onDelete('restrict'),
  check('menu_import_runs_mode_check', sql`${t.mode} IN ('preview', 'apply')`),
  check('menu_import_runs_status_check', sql`${t.status} IN ('running', 'completed', 'failed')`),
  index('menu_import_runs_property_started_idx').on(t.propertyId, t.startedAt),
]);

// --- Categorias de Menu ---
export const menuCategories = pgTable('menu_categories', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  name: varchar({ length: 160 }).notNull(),
  position: integer().notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  managementMode: varchar('management_mode', { length: 16 }).notNull().default('manual'),
  sourceSystem: varchar('source_system', { length: 80 }),
  sourceKey: varchar('source_key', { length: 240 }),
  sourceHash: varchar('source_hash', { length: 64 }),
  lastImportRunId: uuid('last_import_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('menu_categories_id_property_unique').on(t.id, t.propertyId),
  unique('menu_categories_property_source_key_unique').on(t.propertyId, t.sourceSystem, t.sourceKey),
  foreignKey({ name: 'menu_categories_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'menu_categories_import_run_property_fkey', columns: [t.lastImportRunId, t.propertyId], foreignColumns: [menuImportRuns.id, menuImportRuns.propertyId] }).onDelete('restrict'),
  index('menu_categories_property_position_idx').on(t.propertyId, t.position),
]);

// --- Estaciones de Produccion ---
export const productionStations = pgTable('production_stations', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  name: varchar({ length: 120 }).notNull(),
  status: varchar({ length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('production_stations_id_property_unique').on(t.id, t.propertyId),
  unique('production_stations_property_name_unique').on(t.propertyId, t.name),
  foreignKey({ name: 'production_stations_property_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
]);

// --- Catalogo de menu (recetas / productos) ---
export const menuItems = pgTable('menu_items', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  categoryId: uuid('category_id'),
  productionStationId: uuid('production_station_id'),
  name: varchar({ length: 160 }).notNull(),
  category: varchar({ length: 60 }).notNull(),
  position: integer().notNull().default(0),
  salePrice: numeric('sale_price', { precision: 14, scale: 2 }),
  currency: varchar({ length: 3 }).notNull().default('PEN'),
  description: varchar({ length: 400 }),
  preparationMinutes: integer('preparation_minutes').default(10),
  status: varchar({ length: 20 }).notNull().default('active'),
  isPublished: boolean('is_published').notNull().default(true),
  isAvailable: boolean('is_available').notNull().default(true),
  managementMode: varchar('management_mode', { length: 16 }).notNull().default('manual'),
  sourceSystem: varchar('source_system', { length: 80 }),
  sourceKey: varchar('source_key', { length: 240 }),
  sourceHash: varchar('source_hash', { length: 64 }),
  lastImportRunId: uuid('last_import_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('menu_items_id_property_unique').on(t.id, t.propertyId),
  unique('menu_items_property_source_key_unique').on(t.propertyId, t.sourceSystem, t.sourceKey),
  foreignKey({ name: 'menu_items_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'menu_items_category_property_fkey', columns: [t.categoryId, t.propertyId], foreignColumns: [menuCategories.id, menuCategories.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'menu_items_station_property_fkey', columns: [t.productionStationId, t.propertyId], foreignColumns: [productionStations.id, productionStations.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'menu_items_import_run_property_fkey', columns: [t.lastImportRunId, t.propertyId], foreignColumns: [menuImportRuns.id, menuImportRuns.propertyId] }).onDelete('restrict'),
  index('menu_items_property_status_idx').on(t.propertyId, t.status),
  index('menu_items_category_idx').on(t.categoryId, t.position),
]);

// --- Variantes de Items de Menu ---
export const menuItemVariants = pgTable('menu_item_variants', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  menuItemId: uuid('menu_item_id').notNull(),
  name: varchar({ length: 80 }),
  price: numeric({ precision: 14, scale: 2 }),
  currency: varchar({ length: 3 }).notNull().default('PEN'),
  position: integer().notNull().default(0),
  status: varchar({ length: 20 }).notNull().default('active'),
  isPublished: boolean('is_published').notNull().default(true),
  isAvailable: boolean('is_available').notNull().default(true),
  managementMode: varchar('management_mode', { length: 16 }).notNull().default('manual'),
  sourceSystem: varchar('source_system', { length: 80 }),
  sourceKey: varchar('source_key', { length: 280 }),
  sourceHash: varchar('source_hash', { length: 64 }),
  lastImportRunId: uuid('last_import_run_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('menu_item_variants_id_property_item_unique').on(t.id, t.propertyId, t.menuItemId),
  unique('menu_item_variants_property_source_key_unique').on(t.propertyId, t.sourceSystem, t.sourceKey),
  foreignKey({ name: 'menu_item_variants_item_property_fkey', columns: [t.menuItemId, t.propertyId], foreignColumns: [menuItems.id, menuItems.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'menu_item_variants_import_run_property_fkey', columns: [t.lastImportRunId, t.propertyId], foreignColumns: [menuImportRuns.id, menuImportRuns.propertyId] }).onDelete('restrict'),
  index('menu_item_variants_item_position_idx').on(t.menuItemId, t.position),
]);

// --- Ingredientes de cada item del menu ---
export const menuItemIngredients = pgTable('menu_item_ingredients', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  menuItemId: uuid('menu_item_id').notNull(),
  inventoryItemId: uuid('inventory_item_id').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 30 }).notNull().default('und'),
  detail: varchar('detail', { length: 160 }),
}, (t) => [
  foreignKey({ name: 'menu_ingredients_item_property_fkey', columns: [t.menuItemId, t.propertyId], foreignColumns: [menuItems.id, menuItems.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'menu_ingredients_inventory_property_fkey', columns: [t.inventoryItemId, t.propertyId], foreignColumns: [inventoryItems.id, inventoryItems.propertyId] }).onDelete('restrict'),
  index('menu_item_ingredients_item_idx').on(t.menuItemId),
]);

// --- Inventario de insumos ---
export const inventoryItems = pgTable('inventory_items', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  name: varchar({ length: 160 }).notNull(),
  unit: varchar({ length: 40 }).notNull(),
  lot: varchar({ length: 60 }),
  stock: numeric({ precision: 12, scale: 4 }).notNull().default('0'),
  reserved: numeric({ precision: 12, scale: 4 }).notNull().default('0'),
  minimum: numeric({ precision: 12, scale: 4 }).notNull().default('1'),
  cost: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
  supplierId: varchar('supplier_id', { length: 48 }),
  status: varchar({ length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('inventory_items_id_property_unique').on(t.id, t.propertyId),
  foreignKey({ name: 'inventory_items_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  index('inventory_items_property_status_idx').on(t.propertyId, t.status),
]);

// --- Ledger de movimientos de inventario ---
export const inventoryLedger = pgTable('inventory_ledger', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  inventoryItemId: uuid('inventory_item_id').notNull(),
  type: varchar({ length: 30 }).notNull(),
  quantity: numeric({ precision: 12, scale: 4 }).notNull(),
  referenceId: varchar('reference_id', { length: 48 }),
  note: varchar({ length: 300 }),
  responsible: varchar({ length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'inventory_ledger_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'inventory_ledger_item_property_fkey', columns: [t.inventoryItemId, t.propertyId], foreignColumns: [inventoryItems.id, inventoryItems.propertyId] }).onDelete('restrict'),
  index('inventory_ledger_item_created_idx').on(t.inventoryItemId, t.createdAt),
]);

// --- Pedidos de restaurante ---
export const orders = pgTable('orders', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  source: varchar({ length: 30 }).notNull(),
  stayId: uuid('stay_id'),
  amenityReservationId: uuid('amenity_reservation_id'),
  status: varchar({ length: 40 }).notNull().default('Pedido recibido'),
  inventoryStage: varchar('inventory_stage', { length: 20 }).notNull().default('Sin reservar'),
  accountingStage: varchar('accounting_stage', { length: 20 }).notNull().default('Pendiente'),
  paymentMethod: varchar('payment_method', { length: 40 }).notNull().default('Efectivo'),
  total: numeric({ precision: 14, scale: 2 }).notNull().default('0'),
  estimatedMinutes: integer('estimated_minutes').notNull().default(15),
  comment: varchar({ length: 400 }),
  responsible: varchar({ length: 120 }).notNull(),
  cancelReason: varchar('cancel_reason', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('orders_id_property_unique').on(t.id, t.propertyId),
  foreignKey({ name: 'orders_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'orders_stay_property_fkey', columns: [t.stayId, t.propertyId], foreignColumns: [stays.id, stays.propertyId] }).onDelete('restrict'),
  foreignKey({ name: 'orders_amenity_property_fkey', columns: [t.amenityReservationId], foreignColumns: [amenityReservations.id] }).onDelete('set null'),
  index('orders_property_status_idx').on(t.propertyId, t.status),
  index('orders_stay_idx').on(t.stayId),
  index('orders_amenity_idx').on(t.amenityReservationId),
]);

// --- Lineas de pedido ---
export const orderItems = pgTable('order_items', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  orderId: uuid('order_id').notNull(),
  menuItemId: uuid('menu_item_id').notNull(),
  menuItemName: varchar('menu_item_name', { length: 160 }).notNull(),
  menuItemVariantId: uuid('menu_item_variant_id'),
  menuItemVariantName: varchar('menu_item_variant_name', { length: 80 }),
  quantity: integer().notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  currency: varchar({ length: 3 }).notNull().default('PEN'),
  subtotal: numeric({ precision: 14, scale: 2 }).notNull(),
  station: varchar('station', { length: 30 }).notNull().default('kitchen'),
  status: varchar('status', { length: 30 }).notNull().default('recibido'),
  notes: varchar('notes', { length: 250 }),
}, (t) => [
  foreignKey({ name: 'order_items_order_property_fkey', columns: [t.orderId, t.propertyId], foreignColumns: [orders.id, orders.propertyId] }).onDelete('cascade'),
  foreignKey({ name: 'order_items_menu_item_property_fkey', columns: [t.menuItemId, t.propertyId], foreignColumns: [menuItems.id, menuItems.propertyId] }).onDelete('restrict'),
  index('order_items_order_idx').on(t.orderId),
]);
