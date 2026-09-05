import { z } from 'zod';

const menuItemIngredientSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive().finite(),
  unit: z.string().trim().min(1).max(30).default('und'),
  detail: z.string().trim().max(160).optional().nullable(),
});

const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(100),
  salePrice: z.number().positive().finite(),
  description: z.string().trim().max(400).optional().nullable(),
  preparationMinutes: z.number().int().min(1).max(180).default(10),
  ingredients: z.array(menuItemIngredientSchema).min(0).default([]),
});
export type CreateMenuItemDto = z.infer<typeof menuItemSchema>;
export const parseCreateMenuItemDto = (body: unknown): CreateMenuItemDto => menuItemSchema.parse(body);
export const parseUpdateMenuItemDto = (body: unknown): CreateMenuItemDto => menuItemSchema.parse(body);

const inventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().max(40),
  lot: z.string().trim().max(60).optional().nullable(),
  minimum: z.number().nonnegative().finite().default(1),
  cost: z.number().nonnegative().finite().default(0),
  supplierId: z.string().trim().max(48).optional().nullable(),
});
export type CreateInventoryItemDto = z.infer<typeof inventoryItemSchema>;
export const parseCreateInventoryItemDto = (body: unknown): CreateInventoryItemDto => inventoryItemSchema.parse(body);
export const parseUpdateInventoryItemDto = (body: unknown): CreateInventoryItemDto => inventoryItemSchema.parse(body);

const adjustInventorySchema = z.object({
  quantity: z.number().finite(),
  note: z.string().trim().max(300).optional().nullable(),
  type: z.string().trim().min(2).max(30).default('Ajuste'),
});
export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;
export const parseAdjustInventoryDto = (body: unknown): AdjustInventoryDto => adjustInventorySchema.parse(body);

const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().max(250).optional().nullable(),
  station: z.enum(['bar', 'kitchen', 'coffee']).optional(),
});

const createOrderSchema = z.object({
  source: z.string().trim().min(1).max(30),
  stayId: z.string().uuid().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1),
  paymentMethod: z.string().trim().max(40).default('Efectivo'),
  estimatedMinutes: z.number().int().min(1).max(240).default(15),
  comment: z.string().trim().max(400).optional().nullable(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export const parseCreateOrderDto = (body: unknown): CreateOrderDto => createOrderSchema.parse(body);
export const parseUpdateOrderDto = (body: unknown): CreateOrderDto => createOrderSchema.parse(body);

const advanceOrderSchema = z.object({ expectedStatus: z.string().trim().min(1) });
export type AdvanceOrderDto = z.infer<typeof advanceOrderSchema>;
export const parseAdvanceOrderDto = (body: unknown): AdvanceOrderDto => advanceOrderSchema.parse(body);

const advanceOrderItemSchema = z.object({
  status: z.enum(['recibido', 'en_preparacion', 'listo', 'entregado']),
});
export type AdvanceOrderItemDto = z.infer<typeof advanceOrderItemSchema>;
export const parseAdvanceOrderItemDto = (body: unknown): AdvanceOrderItemDto => advanceOrderItemSchema.parse(body);

const cancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;
export const parseCancelOrderDto = (body: unknown): CancelOrderDto => cancelOrderSchema.parse(body);

const archiveSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export type ArchiveDto = z.infer<typeof archiveSchema>;
export const parseArchiveDto = (body: unknown): ArchiveDto => archiveSchema.parse(body);

export const parseUuidParam = (value: unknown): string => {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new Error('ID invalido');
  return result.data;
};
