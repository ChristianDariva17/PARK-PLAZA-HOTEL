import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function parseZodHttp<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  publicMessage = 'Invalid request body',
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(publicMessage);
  return result.data;
}
