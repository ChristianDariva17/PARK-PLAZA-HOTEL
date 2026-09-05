import { z } from 'zod';

export const createStaffDto = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  documentNormalized: z.string().trim().min(1).max(32).transform(v => v.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  position: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(254).optional(),
});
export const parseCreateStaffDto = (data: unknown) => createStaffDto.parse(data);

export const updateStaffDto = createStaffDto.partial();
export const parseUpdateStaffDto = (data: unknown) => updateStaffDto.parse(data);

export const archiveStaffDto = z.object({
  reason: z.string().trim().min(1).max(255),
});
export const parseArchiveStaffDto = (data: unknown) => archiveStaffDto.parse(data);

export const reactivateStaffDto = z.object({
  reason: z.string().trim().min(1).max(255),
});
export const parseReactivateStaffDto = (data: unknown) => reactivateStaffDto.parse(data);

const isValidIanaTimezone = (tz: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
};

const timeStringRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createWorkScheduleDto = z.object({
  name: z.string().trim().min(1).max(100),
  ianaTimezone: z.string().trim().min(1).max(64).refine(isValidIanaTimezone, { message: 'Invalid IANA Timezone' }),
});
export const parseCreateWorkScheduleDto = (data: unknown) => createWorkScheduleDto.parse(data);

export const assignWorkScheduleDto = z.object({
  workScheduleId: z.string().uuid(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  pattern: z.record(
    z.enum(['0', '1', '2', '3', '4', '5', '6']), // Sunday=0, Monday=1, ...
    z.array(z.object({
      start: z.string().regex(timeStringRegex, 'Must be HH:MM'),
      end: z.string().regex(timeStringRegex, 'Must be HH:MM'),
    }))
  ),
});
export const parseAssignWorkScheduleDto = (data: unknown) => assignWorkScheduleDto.parse(data);

export const enrollBiometricIntentDto = z.object({
  deviceId: z.string().uuid(),
});
export const parseEnrollBiometricIntentDto = (data: unknown) => enrollBiometricIntentDto.parse(data);

export const confirmBiometricBindingDto = z.object({
  deviceId: z.string().uuid(),
  templateReference: z.string().min(1).max(255),
});
export const parseConfirmBiometricBindingDto = (data: unknown) => confirmBiometricBindingDto.parse(data);

