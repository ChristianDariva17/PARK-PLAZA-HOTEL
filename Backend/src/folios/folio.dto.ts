import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

export const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const money = z.string().regex(/^\d+\.\d{2}$/).refine((value) => Number(value) > 0, 'Amount must be positive');
const uuid = z.string().uuid();
const charge = z.object({ amount: money, description: z.string().trim().min(1).max(300) }).strict();
const payment = z.object({ amount: money, method: z.enum(PAYMENT_METHODS) }).strict();
const reversal = z.object({ reason: z.string().trim().min(1).max(300) }).strict();
const page = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
export type FolioChargeDto = z.output<typeof charge>;
export type FolioPaymentDto = z.output<typeof payment>;
export type FolioReversalDto = z.output<typeof reversal>;
export const parseFolioChargeDto = (value: unknown) => parseZodHttp(charge, value);
export const parseFolioPaymentDto = (value: unknown) => parseZodHttp(payment, value);
export const parseFolioReversalDto = (value: unknown) => parseZodHttp(reversal, value);
export const parseFolioEntryId = (value: unknown) => parseZodHttp(uuid, value, 'Invalid folio entry ID');
export const parseFolioPage = (value: unknown) => parseZodHttp(page, value, 'Invalid folio page');
