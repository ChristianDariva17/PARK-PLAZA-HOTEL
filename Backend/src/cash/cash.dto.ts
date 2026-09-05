import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

// Convert numeric strings or raw numbers to numeric strings with two decimal places
const decimalRegex = /^\d+(\.\d{1,2})?$/;
const decimalString = z.union([z.number(), z.string()]).transform((val) => {
  const str = String(val).trim();
  if (!decimalRegex.test(str)) {
    throw new Error('Invalid decimal amount format');
  }
  return Number(str).toFixed(2);
});

const openCashSessionSchema = z.object({
  openingAmount: decimalString,
  responsible: z.string().trim().min(1).max(120),
  shift: z.string().trim().min(1).max(30),
  notes: z.string().trim().max(500).optional(),
}).strict();

const countCashSessionSchema = z.object({
  countedAmount: decimalString,
  note: z.string().trim().max(500).optional(),
}).strict();

const closeCashSessionSchema = z.object({
  countedAmount: decimalString,
  note: z.string().trim().max(500).optional(),
}).strict();

const createCashMovementSchema = z.object({
  type: z.enum(['Ingreso', 'Egreso']),
  concept: z.string().trim().min(1).max(200),
  referenceId: z.string().trim().min(1).max(48).optional(),
  amount: decimalString,
  method: z.literal('Efectivo'),
}).strict();

export type OpenCashSessionDto = z.output<typeof openCashSessionSchema>;
export type CountCashSessionDto = z.output<typeof countCashSessionSchema>;
export type CloseCashSessionDto = z.output<typeof closeCashSessionSchema>;
export type CreateCashMovementDto = z.output<typeof createCashMovementSchema>;

export const parseOpenCashSessionDto = (input: unknown) => parseZodHttp(openCashSessionSchema, input);
export const parseCountCashSessionDto = (input: unknown) => parseZodHttp(countCashSessionSchema, input);
export const parseCloseCashSessionDto = (input: unknown) => parseZodHttp(closeCashSessionSchema, input);
export const parseCreateCashMovementDto = (input: unknown) => parseZodHttp(createCashMovementSchema, input);
export const parseSessionId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid cash session ID');
export const parseIdempotencyKey = (input: unknown) => parseZodHttp(uuid, input, 'Invalid or missing idempotency key');
