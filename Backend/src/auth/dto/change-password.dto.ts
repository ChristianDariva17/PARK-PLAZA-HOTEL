import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
}).strict();

export interface ChangePasswordDto { currentPassword: string; newPassword: string }

export function parseChangePasswordDto(input: unknown): ChangePasswordDto {
  const result = changePasswordSchema.safeParse(input);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}
