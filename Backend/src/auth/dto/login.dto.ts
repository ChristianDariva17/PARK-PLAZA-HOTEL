import { z } from 'zod';
import { parseZodHttp } from '../../http/zod-parser.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
}).strict();

export type LoginDto = z.output<typeof loginSchema>;

export function parseLoginDto(input: unknown): LoginDto {
  return parseZodHttp(loginSchema, input);
}
