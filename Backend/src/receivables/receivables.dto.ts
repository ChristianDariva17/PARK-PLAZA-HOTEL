import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';
import { PAYMENT_METHODS } from '../folios/folio.dto.js';

const uuid = z.string().uuid();
const money = z.string().regex(/^\d+\.\d{2}$/).refine((value) => Number(value) > 0, 'Amount must be positive');
const collection = z.object({ amount: money, method: z.enum(PAYMENT_METHODS), reference: z.string().trim().max(300).optional() }).strict();
const reversal = z.object({ reason: z.string().trim().min(1).max(300) }).strict();
const status = z.enum(['open', 'settled']);
const age = z.enum(['0_30', '31_60', '61_90', '91_plus']);

export type ReceivableCollectionDto = z.output<typeof collection>;
export type ReceivableReversalDto = z.output<typeof reversal>;
export const parseReceivableId = (value: unknown) => parseZodHttp(uuid, value, 'Invalid receivable ID');
export const parseReceivableEntryId = (value: unknown) => parseZodHttp(uuid, value, 'Invalid receivable entry ID');
export const parseCollectionDto = (value: unknown) => parseZodHttp(collection, value);
export const parseReversalDto = (value: unknown) => parseZodHttp(reversal, value);
export const parseListFilters = (value: unknown) => parseZodHttp(z.object({ status: status.optional(), age: age.optional() }).strict(), value, 'Invalid receivable filters');
