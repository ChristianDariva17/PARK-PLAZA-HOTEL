import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

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

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}

export const parseCreateAccountDto = (input: unknown) => parse(createAccountSchema, input);
export const parseUpdateAccountDto = (input: unknown) => parse(updateAccountSchema, input);
export const parseResetPasswordDto = (input: unknown) => parse(resetPasswordSchema, input);
export const parseAccountId = (input: unknown) => parse(uuid, input);
