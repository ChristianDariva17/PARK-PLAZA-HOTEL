import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

const utcTimestamp = z.string().regex(UTC_TIMESTAMP_PATTERN).refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value);
const positiveGuestCount = z.number().finite().int().positive().max(Number.MAX_SAFE_INTEGER);
const queryGuestCount = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(positiveGuestCount);

const createReservationSchema = z.object({
  roomId: z.string().uuid(),
  primaryGuestId: z.string().uuid(),
  checkInAt: utcTimestamp,
  checkOutAt: utcTimestamp,
  guestCount: positiveGuestCount,
}).strict().refine((value) => value.checkOutAt > value.checkInAt);

const availabilityQuerySchema = z.object({
  checkInAt: utcTimestamp,
  checkOutAt: utcTimestamp,
  guestCount: queryGuestCount,
}).strict().refine((value) => value.checkOutAt > value.checkInAt);

export type CreateReservationDto = z.output<typeof createReservationSchema>;
export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;

export const parseCreateReservationDto = (input: unknown) => parseZodHttp(createReservationSchema, input);
export const parseAvailabilityQuery = (input: unknown) => parseZodHttp(availabilityQuerySchema, input, 'Invalid availability query');
