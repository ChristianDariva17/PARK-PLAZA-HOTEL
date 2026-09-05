import { z } from 'zod';
import type { MoneyString } from './money.js';

export const moneyStringSchema = z.string()
  .regex(/^[-]?\d+\.\d{2}$/, 'Invalid money format. Use exact two decimal places (e.g., "10.00").')
  .refine(val => {
    const cleanValue = val.startsWith('-') ? val.slice(1) : val;
    return (cleanValue.split('.')[0] || '').length <= 12;
  }, 'Money value out of range.') as unknown as unknown as z.ZodType<MoneyString>;

export const nonNegativeMoneySchema = moneyStringSchema.refine(
  val => !val.startsWith('-'), 
  'Money amount must be non-negative.'
);

export const positiveMoneySchema = nonNegativeMoneySchema.refine(
  val => val !== '0.00' && val !== '-0.00',
  'Money amount must be strictly positive.'
);
