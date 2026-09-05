import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val));
const fee = z.coerce.number().finite().min(0);

const parkingFields = {
  stayId: uuid.optional().nullable(),
  clientId: uuid.optional().nullable(),
  roomId: uuid.optional().nullable(),
  originType: z.enum(['stay', 'restaurant', 'event', 'visitor']).default('stay'),
  driverName: optionalText(150),
  driverPhone: optionalText(50),
  vehicleColor: optionalText(50),
  keysLeft: z.coerce.boolean().default(false),
  entryNotes: optionalText(1000),

  plate: requiredText(20).transform((value) => value.toUpperCase()),
  space: requiredText(50).transform((value) => value.toUpperCase()),
  fee,
  vehicleType: requiredText(50),
  brandModel: optionalText(100),
  entryResponsible: requiredText(100),
};

const createParkingSchema = z
  .object({
    id: z.string().trim().regex(/^VEH-[A-Z0-9-]+$/).max(20),
    ...parkingFields,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.originType === 'stay') {
      if (!data.stayId || !data.clientId || !data.roomId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Para vehículos de huéspedes, la estadía, cliente y habitación son obligatorios.',
        });
      }
    } else if (!data.driverName || !data.driverName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para clientes externos o visitas, el nombre del conductor es obligatorio.',
      });
    }
  });

const updateParkingSchema = z
  .object({
    stayId: parkingFields.stayId,
    clientId: parkingFields.clientId,
    roomId: parkingFields.roomId,
    originType: z.enum(['stay', 'restaurant', 'event', 'visitor']).optional(),
    driverName: parkingFields.driverName,
    driverPhone: parkingFields.driverPhone,
    vehicleColor: parkingFields.vehicleColor,
    keysLeft: z.coerce.boolean().optional(),
    entryNotes: parkingFields.entryNotes,
    plate: parkingFields.plate.optional(),
    space: parkingFields.space.optional(),
    fee: parkingFields.fee.optional(),
    vehicleType: parkingFields.vehicleType.optional(),
    brandModel: parkingFields.brandModel,
    entryResponsible: parkingFields.entryResponsible.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const exitParkingSchema = z
  .object({
    exitObservation: optionalText(1000),
    exitResponsible: requiredText(100),
  })
  .strict();

const archiveParkingSchema = z.object({ reason: requiredText(1000) }).strict();

export type CreateParkingDto = z.output<typeof createParkingSchema>;
export type UpdateParkingDto = z.output<typeof updateParkingSchema>;
export type ExitParkingDto = z.output<typeof exitParkingSchema>;

export const parseCreateParkingDto = (input: unknown) => parseZodHttp(createParkingSchema, input);
export const parseUpdateParkingDto = (input: unknown) => parseZodHttp(updateParkingSchema, input);
export const parseExitParkingDto = (input: unknown) => parseZodHttp(exitParkingSchema, input);
export const parseArchiveParkingDto = (input: unknown) => parseZodHttp(archiveParkingSchema, input);
