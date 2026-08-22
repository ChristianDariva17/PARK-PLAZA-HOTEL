import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

const updateRoomSchema = z.object({
  number: z.string().trim().min(1).max(16).optional(),
  floor: z.number().finite().int().optional(),
  categoryId: uuid.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const blockRoomSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().trim().min(1).max(500),
}).strict();

export type UpdateRoomDto = z.output<typeof updateRoomSchema>;
export type BlockRoomDto = z.output<typeof blockRoomSchema>;

export const parseUpdateRoomDto = (input: unknown) => parseZodHttp(updateRoomSchema, input);
export const parseBlockRoomDto = (input: unknown) => parseZodHttp(blockRoomSchema, input);
export const parseRoomId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid room ID');
