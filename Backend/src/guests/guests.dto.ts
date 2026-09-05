import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();
const isoCountry = z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/));
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null).nullable().optional();
const optionalDate = z.string().trim().transform((value) => value || null).pipe(z.iso.date().nullable()).nullable().optional();
const optionalCountry = z.string().trim().transform((value) => value ? value.toUpperCase() : null).pipe(z.union([z.string().regex(/^[A-Z]{2}$/), z.null()])).nullable().optional();
const optionalEmail = z.string().trim().max(254).transform((value) => value ? value.toLowerCase() : null).pipe(z.union([z.email(), z.null()])).nullable().optional();

const primaryDocumentSchema = z.object({
  type: z.enum(['dni', 'passport', 'foreign_id', 'other']),
  issuingCountry: isoCountry,
  documentNumber: requiredText(64).transform((value) => value.toUpperCase()),
  expiresOn: optionalDate,
}).strict();

const guestFields = {
  firstName: requiredText(100),
  lastName: requiredText(100),
  birthDate: optionalDate,
  nationality: optionalCountry,
  email: optionalEmail,
  phone: optionalText(32),
  address: optionalText(500),
  emergencyContact: optionalText(255),
  notes: optionalText(2000),
};

export const createGuestSchema = z.object({ ...guestFields, primaryDocument: primaryDocumentSchema }).strict();
const updatePrimaryDocumentSchema = primaryDocumentSchema.partial().strict().refine((value) => Object.keys(value).length > 0);
const updateGuestSchema = z.object({
  firstName: guestFields.firstName.optional(),
  lastName: guestFields.lastName.optional(),
  birthDate: guestFields.birthDate,
  nationality: guestFields.nationality,
  email: guestFields.email,
  phone: guestFields.phone,
  address: guestFields.address,
  emergencyContact: guestFields.emergencyContact,
  notes: guestFields.notes,
  primaryDocument: updatePrimaryDocumentSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export type CreateGuestDto = z.output<typeof createGuestSchema>;
export type UpdateGuestDto = z.output<typeof updateGuestSchema>;

export const parseCreateGuestDto = (input: unknown) => parseZodHttp(createGuestSchema, input);
export const parseUpdateGuestDto = (input: unknown) => parseZodHttp(updateGuestSchema, input);
export const parseGuestId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid guest ID');
