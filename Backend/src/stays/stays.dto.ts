import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const utcTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/).refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value);
const uuid = z.string().uuid();
const commandKey = uuid;

const checkInSchema = z.object({ earlyCheckInAt: utcTimestamp.optional() }).strict();
const checkOutSchema = z.object({ overrideReason: z.string().trim().min(1).max(300).optional() }).strict();
const walkInSchema = z.object({ roomId: uuid, primaryGuestId: uuid, guestIds: z.array(uuid).min(1).max(16), checkInAt: utcTimestamp, checkOutAt: utcTimestamp, guestCount: z.number().int().positive().max(16) })
  .strict().refine((value) => value.guestIds.includes(value.primaryGuestId) && new Set(value.guestIds).size === value.guestIds.length && value.guestIds.length === value.guestCount && value.checkOutAt > value.checkInAt);

export type CheckInDto = z.output<typeof checkInSchema>;
export type CheckOutDto = z.output<typeof checkOutSchema>;
export type WalkInDto = z.output<typeof walkInSchema>;
export const parseCheckInDto = (input: unknown) => parseZodHttp(checkInSchema, input);
export const parseCheckOutDto = (input: unknown) => parseZodHttp(checkOutSchema, input);
export const parseWalkInDto = (input: unknown) => parseZodHttp(walkInSchema, input);
export const parseStayId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid stay ID');
export const parseIdempotencyKey = (value: unknown): string => parseZodHttp(commandKey, value, 'Invalid Idempotency-Key');
