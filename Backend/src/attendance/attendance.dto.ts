import { z } from 'zod';

export const reportManualAttendanceDto = z.object({
  staffId: z.string().uuid(),
  movement: z.enum(['Ingreso', 'Salida']),
  occurredAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().uuid(),
});
export const parseReportManualAttendanceDto = (data: unknown) => reportManualAttendanceDto.parse(data);

export const reportBiometricAttendanceDto = z.object({
  staffId: z.string().uuid(),
  deviceId: z.string().uuid(),
  bridgeOperationId: z.string().max(64),
  templateReference: z.string().min(1).max(255),
  movement: z.enum(['Ingreso', 'Salida']),
  occurredAt: z.coerce.date(),
  idempotencyKey: z.string().uuid().optional(), // Or we can use bridgeOperationId
});
export const parseReportBiometricAttendanceDto = (data: unknown) => reportBiometricAttendanceDto.parse(data);

export const bridgeCapabilityDto = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('health') }),
  z.object({ operation: z.enum(['enroll', 'verify']), subjectType: z.enum(['client', 'employee']), subjectId: z.string().uuid() }),
]);
export const parseBridgeCapabilityDto = (data: unknown) => bridgeCapabilityDto.parse(data);

export const submitCorrectionDto = z.object({
  attendanceEventId: z.string().uuid(),
  correctionType: z.string().trim().min(1).max(64),
  proposedValues: z.record(z.string(), z.any()),
  reason: z.string().trim().min(1).max(255),
});
export const parseSubmitCorrectionDto = (data: unknown) => submitCorrectionDto.parse(data);

export const approveCorrectionDto = z.object({
  approved: z.boolean(),
  notes: z.string().trim().max(255).optional(),
});
export const parseApproveCorrectionDto = (data: unknown) => approveCorrectionDto.parse(data);

export const reportQrAttendanceDto = z.object({
  qrToken: z.string().trim().min(10),
  staffId: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(500).optional().default(10),
  movement: z.enum(['Ingreso', 'Salida']).optional(),
  idempotencyKey: z.string().uuid(),
});
export const parseReportQrAttendanceDto = (data: unknown) => reportQrAttendanceDto.parse(data);
