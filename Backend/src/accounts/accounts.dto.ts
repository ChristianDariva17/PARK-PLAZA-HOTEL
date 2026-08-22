import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const uuid = z.string().uuid();

const createAccountSchema = z.object({
  email,
  roleKey: z.string().trim().min(1).max(64),
  temporaryPassword: z.string().min(1).max(1024),
  personnelId: uuid.optional(),
}).strict();

const updateAccountSchema = z.object({
  email: email.optional(),
  roleKey: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  personnelId: uuid.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const resetPasswordSchema = z.object({ temporaryPassword: z.string().min(1).max(1024) }).strict();

export type CreateAccountDto = z.output<typeof createAccountSchema>;
export type UpdateAccountDto = z.output<typeof updateAccountSchema>;
export type ResetPasswordDto = z.output<typeof resetPasswordSchema>;

export const parseCreateAccountDto = (input: unknown) => parseZodHttp(createAccountSchema, input);
export const parseUpdateAccountDto = (input: unknown) => parseZodHttp(updateAccountSchema, input);
export const parseResetPasswordDto = (input: unknown) => parseZodHttp(resetPasswordSchema, input);
export const parseAccountId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid account ID');
