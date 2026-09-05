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

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  capacity: z.number().finite().int().positive().optional(),
  baseNightlyRate: z.union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
    z.number().finite().nonnegative(),
  ]).transform((val) => typeof val === 'number' ? val.toFixed(2) : Number(val).toFixed(2)).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export type UpdateCategoryDto = z.output<typeof updateCategorySchema>;

const updateCategoryAmenitiesSchema = z.object({
  amenityKeys: z.array(z.string().trim().min(1).max(50)),
}).strict();

export type UpdateCategoryAmenitiesDto = z.output<typeof updateCategoryAmenitiesSchema>;

export const parseUpdateRoomDto = (input: unknown) => parseZodHttp(updateRoomSchema, input);
export const parseBlockRoomDto = (input: unknown) => parseZodHttp(blockRoomSchema, input);
export const parseRoomId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid room ID');
export const parseCategoryId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid category ID');
export const parseUpdateCategoryDto = (input: unknown) => parseZodHttp(updateCategorySchema, input);
export const parseUpdateCategoryAmenitiesDto = (input: unknown) => parseZodHttp(updateCategoryAmenitiesSchema, input);
