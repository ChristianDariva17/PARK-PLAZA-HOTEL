import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
}).strict();

export interface LoginDto { email: string; password: string }

export function parseLoginDto(input: unknown): LoginDto {
  const result = loginSchema.safeParse(input);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}
