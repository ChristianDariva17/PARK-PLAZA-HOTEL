import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const charge = z.coerce.number().finite().min(0);

const petFields = {
  stayId: uuid.nullable().optional(),
  clientId: uuid.nullable().optional(),
  name: requiredText(100),
  type: requiredText(50),
  breed: optionalText(100),
  size: requiredText(50),
  lodgingPlace: requiredText(100),
  charge,
  notes: optionalText(2000),
  damageIncidentId: optionalText(50),
  vaccinationVerified: z.boolean().default(false),
  temperament: optionalText(50),
  emergencyContact: optionalText(100),
  welcomeKitDelivered: z.boolean().default(false),
  originType: z.enum(['stay', 'restaurant', 'daycare', 'visitor']).default('stay'),
  ownerName: optionalText(100),
  ownerPhone: optionalText(50),
};

const createPetSchema = z.object({
  id: z.string().trim().regex(/^PET-[A-Z0-9-]+$/).max(20),
  ...petFields,
}).strict().refine((data) => {
  if (data.originType === 'stay') {
    return Boolean(data.stayId && data.clientId);
  }
  return Boolean(data.ownerName?.trim() || data.clientId);
}, {
  message: 'Stay and client are required for room guests; ownerName is required for external visitors',
});

const updatePetSchema = z.object({
  name: petFields.name.optional(),
  type: petFields.type.optional(),
  breed: petFields.breed,
  size: petFields.size.optional(),
  lodgingPlace: petFields.lodgingPlace.optional(),
  notes: petFields.notes,
  damageIncidentId: petFields.damageIncidentId,
  vaccinationVerified: z.boolean().optional(),
  temperament: petFields.temperament,
  emergencyContact: petFields.emergencyContact,
  welcomeKitDelivered: z.boolean().optional(),
  ownerName: petFields.ownerName,
  ownerPhone: petFields.ownerPhone,
}).strict().refine((value) => Object.keys(value).length > 0);

const transitionPetSchema = z.object({ reason: requiredText(1000) }).strict();

export type CreatePetDto = z.output<typeof createPetSchema>;
export type UpdatePetDto = z.output<typeof updatePetSchema>;

export const parseCreatePetDto = (input: unknown) => parseZodHttp(createPetSchema, input);
export const parseUpdatePetDto = (input: unknown) => parseZodHttp(updatePetSchema, input);
export const parseTransitionPetDto = (input: unknown) => parseZodHttp(transitionPetSchema, input);
