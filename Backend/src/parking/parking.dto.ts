import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const fee = z.coerce.number().finite().min(0);

const parkingFields = {
  stayId: uuid,
  clientId: uuid,
  roomId: uuid,
  plate: requiredText(20).transform((value) => value.toUpperCase()),
  space: requiredText(50).transform((value) => value.toUpperCase()),
  fee,
  vehicleType: requiredText(50),
  brandModel: requiredText(100),
  entryResponsible: requiredText(100),
};

const createParkingSchema = z.object({
  id: z.string().trim().regex(/^VEH-[A-Z0-9-]+$/).max(20),
  ...parkingFields,
}).strict();

const updateParkingSchema = z.object({
  stayId: parkingFields.stayId.optional(),
  clientId: parkingFields.clientId.optional(),
  roomId: parkingFields.roomId.optional(),
  plate: parkingFields.plate.optional(),
  space: parkingFields.space.optional(),
  fee: parkingFields.fee.optional(),
  vehicleType: parkingFields.vehicleType.optional(),
  brandModel: parkingFields.brandModel.optional(),
  entryResponsible: parkingFields.entryResponsible.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const exitParkingSchema = z.object({
  exitObservation: optionalText(1000),
  exitResponsible: requiredText(100),
}).strict();

const archiveParkingSchema = z.object({ reason: requiredText(1000) }).strict();

export type CreateParkingDto = z.output<typeof createParkingSchema>;
export type UpdateParkingDto = z.output<typeof updateParkingSchema>;
export type ExitParkingDto = z.output<typeof exitParkingSchema>;

export const parseCreateParkingDto = (input: unknown) => parseZodHttp(createParkingSchema, input);
export const parseUpdateParkingDto = (input: unknown) => parseZodHttp(updateParkingSchema, input);
export const parseExitParkingDto = (input: unknown) => parseZodHttp(exitParkingSchema, input);
export const parseArchiveParkingDto = (input: unknown) => parseZodHttp(archiveParkingSchema, input);
