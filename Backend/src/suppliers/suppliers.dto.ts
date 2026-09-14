import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

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
}).strict();
export type CreateSupplierDto = z.infer<typeof CreateSupplierDto>;

export const UpdateSupplierDto = CreateSupplierDto.partial().strict();
export type UpdateSupplierDto = z.infer<typeof UpdateSupplierDto>;

export const ArchiveSupplierDto = z.object({
  reason: z.string().min(3).max(500),
  expectedVersion: z.number().int().positive(),
}).strict();
export type ArchiveSupplierDto = z.infer<typeof ArchiveSupplierDto>;

export const ReactivateSupplierDto = z.object({
  reason: z.string().min(3).max(500),
  expectedVersion: z.number().int().positive(),
}).strict();
export type ReactivateSupplierDto = z.infer<typeof ReactivateSupplierDto>;

export const AssignSupplierInventoryDto = z.object({
  itemIds: z.array(z.string().uuid()),
}).strict();
export type AssignSupplierInventoryDto = z.infer<typeof AssignSupplierInventoryDto>;

export const RestockItemDto = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  lot: z.string().max(60).optional(),
}).strict();

export const RestockFromSupplierDto = z.object({
  items: z.array(RestockItemDto).min(1),
  invoiceNumber: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
}).strict();
export type RestockFromSupplierDto = z.infer<typeof RestockFromSupplierDto>;

export const PurchaseOrderItemDto = z.object({
  inventoryItemId: z.string().uuid(),
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).default(0),
}).strict();

export const CreatePurchaseOrderDto = z.object({
  supplierId: z.string().uuid(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  currency: z.string().max(3).default('PEN'),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(PurchaseOrderItemDto).min(1),
}).strict();
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderDto>;

export const ReceivePurchaseOrderDto = z.object({
  invoiceNumber: z.string().max(80).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  ratingNotes: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
}).strict();
export type ReceivePurchaseOrderDto = z.infer<typeof ReceivePurchaseOrderDto>;

export const RateSupplierDto = z.object({
  rating: z.number().int().min(1).max(5),
  ratingNotes: z.string().max(500).optional().nullable(),
}).strict();
export type RateSupplierDto = z.infer<typeof RateSupplierDto>;

export const parseCreateSupplierDto = (body: unknown): CreateSupplierDto => parseZodHttp(CreateSupplierDto, body, 'Datos de proveedor inválidos');
export const parseUpdateSupplierDto = (body: unknown): UpdateSupplierDto => parseZodHttp(UpdateSupplierDto, body, 'Datos de actualización de proveedor inválidos');
export const parseArchiveSupplierDto = (body: unknown): ArchiveSupplierDto => parseZodHttp(ArchiveSupplierDto, body, 'Datos de archivo de proveedor inválidos');
export const parseReactivateSupplierDto = (body: unknown): ReactivateSupplierDto => parseZodHttp(ReactivateSupplierDto, body, 'Datos de reactivación de proveedor inválidos');
export const parseAssignSupplierInventoryDto = (body: unknown): AssignSupplierInventoryDto => parseZodHttp(AssignSupplierInventoryDto, body, 'Datos de asignación de inventario inválidos');
export const parseRestockFromSupplierDto = (body: unknown): RestockFromSupplierDto => parseZodHttp(RestockFromSupplierDto, body, 'Datos de reposición inválidos');
export const parseCreatePurchaseOrderDto = (body: unknown): CreatePurchaseOrderDto => parseZodHttp(CreatePurchaseOrderDto, body, 'Datos de orden de compra inválidos');
export const parseReceivePurchaseOrderDto = (body: unknown): ReceivePurchaseOrderDto => parseZodHttp(ReceivePurchaseOrderDto, body, 'Datos de recepción inválidos');
export const parseRateSupplierDto = (body: unknown): RateSupplierDto => parseZodHttp(RateSupplierDto, body, 'Datos de calificación inválidos');
export const parseIdempotencyKey = (value: unknown): string => parseZodHttp(z.string().uuid(), value, 'Idempotency-Key header is required and must be a UUID');

export const parseUuidParam = (value: unknown): string => {
  return parseZodHttp(z.string().uuid(), value, 'Invalid UUID');
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
