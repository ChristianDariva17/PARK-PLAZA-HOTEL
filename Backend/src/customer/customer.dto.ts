import { z } from 'zod';
import { createGuestSchema } from '../guests/guests.dto.js';
import { parseZodHttp } from '../http/zod-parser.js';

const civilDate = z.iso.date();
const positiveGuestCount = z.number().finite().int().positive().max(Number.MAX_SAFE_INTEGER);

const firebaseExchangeSchema = z.object({ idToken: z.string().min(1).max(16_384) }).strict();
const customerAvailabilitySchema = z.object({
  checkInDate: civilDate,
  checkOutDate: civilDate,
  guestCount: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(positiveGuestCount),
}).strict().refine((value) => value.checkOutDate > value.checkInDate);
const customerBookingSchema = z.object({
  categoryCode: z.string().trim().regex(/^[A-Za-z0-9_-]{1,32}$/).transform((value) => value.toUpperCase()),
  checkInDate: civilDate,
  checkOutDate: civilDate,
  guestCount: positiveGuestCount,
  guest: createGuestSchema,
}).strict().refine((value) => value.checkOutDate > value.checkInDate);

export type FirebaseExchangeDto = z.output<typeof firebaseExchangeSchema>;
export type CustomerAvailabilityQuery = z.output<typeof customerAvailabilitySchema>;
export type CustomerBookingDto = z.output<typeof customerBookingSchema>;

export const parseFirebaseExchangeDto = (input: unknown) => parseZodHttp(firebaseExchangeSchema, input);
export const parseCustomerAvailabilityQuery = (input: unknown) => parseZodHttp(customerAvailabilitySchema, input, 'Invalid availability query');
export const parseCustomerBookingDto = (input: unknown) => parseZodHttp(customerBookingSchema, input);
export const parseCustomerReservationId = (input: unknown) => parseZodHttp(z.string().uuid(), input, 'Invalid reservation ID');
export const parseCustomerIdempotencyKey = (input: unknown) => parseZodHttp(z.string().uuid(), input, 'Invalid Idempotency-Key');

const deliveryModes = ['Room', 'Terraza', 'Recojo', 'Piscina', 'Mirador'] as const;
const paymentModes = ['room_charge', 'amenity_tab', 'online'] as const;
const cancellationReasons = ['changed_mind', 'duplicate_order', 'wrong_items', 'other'] as const;
const customerCreateOrderSchema = z.object({
  stayId: z.string().uuid().optional().nullable(),
  amenityReservationId: z.string().uuid().optional().nullable(),
  deliveryMode: z.enum(deliveryModes).optional().default('Room'),
  paymentMode: z.enum(paymentModes).optional().default('room_charge'),
  items: z.array(z.object({ menuItemId: z.string().uuid(), variantId: z.string().uuid().optional().nullable(), quantity: z.number().int().positive() })).min(1),
  note: z.string().trim().max(400).optional().default(''),
}).strict().refine((data) => Boolean(data.stayId || data.amenityReservationId), {
  message: 'Debe especificar una estadía de habitación o una reserva de amenidad activa.',
});
const customerCancelOrderSchema = z.object({ reasonCode: z.enum(cancellationReasons) }).strict();

export type CustomerCreateOrderDto = z.infer<typeof customerCreateOrderSchema>;
export type CustomerCancelOrderDto = z.infer<typeof customerCancelOrderSchema>;
export const parseCustomerCreateOrderDto = (input: unknown) => parseZodHttp(customerCreateOrderSchema, input);
export const parseCustomerCancelOrderDto = (input: unknown) => parseZodHttp(customerCancelOrderSchema, input);
