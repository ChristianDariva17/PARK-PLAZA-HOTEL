import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const charge = z.coerce.number().finite().min(0);

const petFields = {
  stayId: uuid.nullable(),
  clientId: uuid,
  name: requiredText(100),
  type: requiredText(50),
  size: requiredText(50),
  lodgingPlace: requiredText(100),
  charge,
  notes: optionalText(2000),
  damageIncidentId: optionalText(50),
};

const createPetSchema = z.object({
  id: z.string().trim().regex(/^PET-[A-Z0-9-]+$/).max(20),
  ...petFields,
}).strict();

const updatePetSchema = z.object({
  stayId: petFields.stayId.optional(),
  clientId: petFields.clientId.optional(),
  name: petFields.name.optional(),
  type: petFields.type.optional(),
  size: petFields.size.optional(),
  lodgingPlace: petFields.lodgingPlace.optional(),
  charge: petFields.charge.optional(),
  notes: petFields.notes,
  damageIncidentId: petFields.damageIncidentId,
}).strict().refine((value) => Object.keys(value).length > 0);

const transitionPetSchema = z.object({ reason: requiredText(1000) }).strict();

export type CreatePetDto = z.output<typeof createPetSchema>;
export type UpdatePetDto = z.output<typeof updatePetSchema>;

export const parseCreatePetDto = (input: unknown) => parseZodHttp(createPetSchema, input);
export const parseUpdatePetDto = (input: unknown) => parseZodHttp(updatePetSchema, input);
export const parseTransitionPetDto = (input: unknown) => parseZodHttp(transitionPetSchema, input);
