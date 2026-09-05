import { z } from 'zod';

export const SupplierCategoryEnum = z.enum([
  'food', 'beverage', 'cleaning', 'maintenance', 'amenities', 'services', 'other'
]);

export const CreateSupplierDto = z.object({
  legalName: z.string().min(2).max(200),
  taxId: z.string().trim().regex(/^\d{11}$/, { message: 'El RUC debe contener exactamente 11 dígitos numéricos' }),
  tradeName: z.string().max(200).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  categories: z.array(SupplierCategoryEnum).optional().default([]),
  averageDeliveryDays: z.number().int().min(0).max(365).optional().default(0),
  isPreferred: z.boolean().optional().default(false),
  rating: z.number().int().min(1).max(5).optional().default(5),
  ratingNotes: z.string().max(500).optional().nullable(),
  inventoryItemIds: z.array(z.string().uuid()).optional(),
});
export type CreateSupplierDto = z.infer<typeof CreateSupplierDto>;

export const UpdateSupplierDto = CreateSupplierDto.partial();
export type UpdateSupplierDto = z.infer<typeof UpdateSupplierDto>;

export const ArchiveSupplierDto = z.object({
  reason: z.string().min(3).max(500),
  expectedVersion: z.number().int().positive(),
});
export type ArchiveSupplierDto = z.infer<typeof ArchiveSupplierDto>;

export const ReactivateSupplierDto = z.object({
  reason: z.string().min(3).max(500),
  expectedVersion: z.number().int().positive(),
});
export type ReactivateSupplierDto = z.infer<typeof ReactivateSupplierDto>;

export const AssignSupplierInventoryDto = z.object({
  itemIds: z.array(z.string().uuid()),
});
export type AssignSupplierInventoryDto = z.infer<typeof AssignSupplierInventoryDto>;

export const RestockItemDto = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  lot: z.string().max(60).optional(),
});

export const RestockFromSupplierDto = z.object({
  items: z.array(RestockItemDto).min(1),
  invoiceNumber: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});
export type RestockFromSupplierDto = z.infer<typeof RestockFromSupplierDto>;

export const PurchaseOrderItemDto = z.object({
  inventoryItemId: z.string().uuid(),
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).default(0),
});

export const CreatePurchaseOrderDto = z.object({
  supplierId: z.string().uuid(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  currency: z.string().max(3).default('PEN'),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(PurchaseOrderItemDto).min(1),
});
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderDto>;

export const ReceivePurchaseOrderDto = z.object({
  invoiceNumber: z.string().max(80).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  ratingNotes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});
export type ReceivePurchaseOrderDto = z.infer<typeof ReceivePurchaseOrderDto>;

export const RateSupplierDto = z.object({
  rating: z.number().int().min(1).max(5),
  ratingNotes: z.string().max(500).optional().nullable(),
});
export type RateSupplierDto = z.infer<typeof RateSupplierDto>;

export const parseCreateSupplierDto = (body: unknown): CreateSupplierDto => CreateSupplierDto.parse(body);
export const parseUpdateSupplierDto = (body: unknown): UpdateSupplierDto => UpdateSupplierDto.parse(body);
export const parseArchiveSupplierDto = (body: unknown): ArchiveSupplierDto => ArchiveSupplierDto.parse(body);
export const parseReactivateSupplierDto = (body: unknown): ReactivateSupplierDto => ReactivateSupplierDto.parse(body);
export const parseAssignSupplierInventoryDto = (body: unknown): AssignSupplierInventoryDto => AssignSupplierInventoryDto.parse(body);
export const parseRestockFromSupplierDto = (body: unknown): RestockFromSupplierDto => RestockFromSupplierDto.parse(body);
export const parseCreatePurchaseOrderDto = (body: unknown): CreatePurchaseOrderDto => CreatePurchaseOrderDto.parse(body);
export const parseReceivePurchaseOrderDto = (body: unknown): ReceivePurchaseOrderDto => ReceivePurchaseOrderDto.parse(body);
export const parseRateSupplierDto = (body: unknown): RateSupplierDto => RateSupplierDto.parse(body);

export const parseUuidParam = (value: unknown): string => {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new Error('Invalid UUID');
  return result.data;
};

export const SupplierResponseDto = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  taxId: z.string(),
  tradeName: z.string().nullable(),
  contactName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  categories: z.array(z.string()),
  averageDeliveryDays: z.number(),
  isPreferred: z.boolean(),
  rating: z.number().optional(),
  ratingNotes: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']),
  version: z.number(),
  suppliedItemsCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SupplierResponseDto = z.infer<typeof SupplierResponseDto>;

export const SupplierListResponseDto = z.object({
  items: z.array(SupplierResponseDto),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type SupplierListResponseDto = z.infer<typeof SupplierListResponseDto>;
