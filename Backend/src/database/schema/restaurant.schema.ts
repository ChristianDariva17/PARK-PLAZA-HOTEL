import { foreignKey, index, integer, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { properties } from './hotel.schema.js';
import { stays } from './stays.schema.js';

// --- Catalogo de menu (recetas / productos) ---
export const menuItems = pgTable('menu_items', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  name: varchar({ length: 160 }).notNull(),
  category: varchar({ length: 60 }).notNull(),
  salePrice: numeric('sale_price', { precision: 14, scale: 2 }).notNull(),
  description: varchar({ length: 400 }),
  preparationMinutes: integer('preparation_minutes').notNull().default(10),
  status: varchar({ length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: 'menu_items_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  index('menu_items_property_status_idx').on(t.propertyId, t.status),
]);

// --- Ingredientes de cada item del menu ---
export const menuItemIngredients = pgTable('menu_item_ingredients', {
  id: uuid().defaultRandom().primaryKey(),
  menuItemId: uuid('menu_item_id').notNull(),
  inventoryItemId: uuid('inventory_item_id').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 4 }).notNull(),
}, (t) => [
  foreignKey({ name: 'menu_ingredients_item_fkey', columns: [t.menuItemId], foreignColumns: [menuItems.id] }).onDelete('cascade'),
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
  foreignKey({ name: 'inventory_ledger_item_fkey', columns: [t.inventoryItemId], foreignColumns: [inventoryItems.id] }).onDelete('restrict'),
  index('inventory_ledger_item_created_idx').on(t.inventoryItemId, t.createdAt),
]);

// --- Pedidos QR ---
export const orders = pgTable('orders', {
  id: uuid().defaultRandom().primaryKey(),
  propertyId: uuid('property_id').notNull(),
  source: varchar({ length: 30 }).notNull(),
  stayId: uuid('stay_id'),
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
  foreignKey({ name: 'orders_property_id_fkey', columns: [t.propertyId], foreignColumns: [properties.id] }).onDelete('restrict'),
  foreignKey({ name: 'orders_stay_id_fkey', columns: [t.stayId], foreignColumns: [stays.id] }).onDelete('set null'),
  index('orders_property_status_idx').on(t.propertyId, t.status),
  index('orders_stay_idx').on(t.stayId),
]);

// --- Lineas de pedido ---
export const orderItems = pgTable('order_items', {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull(),
  menuItemId: uuid('menu_item_id').notNull(),
  menuItemName: varchar('menu_item_name', { length: 160 }).notNull(),
  quantity: integer().notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  subtotal: numeric({ precision: 14, scale: 2 }).notNull(),
}, (t) => [
  foreignKey({ name: 'order_items_order_fkey', columns: [t.orderId], foreignColumns: [orders.id] }).onDelete('cascade'),
  foreignKey({ name: 'order_items_menu_item_fkey', columns: [t.menuItemId], foreignColumns: [menuItems.id] }).onDelete('restrict'),
  index('order_items_order_idx').on(t.orderId),
]);
