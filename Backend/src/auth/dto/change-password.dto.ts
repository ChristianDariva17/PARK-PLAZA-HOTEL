import { z } from 'zod';
import { parseZodHttp } from '../../http/zod-parser.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
}).strict();

export type ChangePasswordDto = z.output<typeof changePasswordSchema>;

export function parseChangePasswordDto(input: unknown): ChangePasswordDto {
  return parseZodHttp(changePasswordSchema, input);
}
