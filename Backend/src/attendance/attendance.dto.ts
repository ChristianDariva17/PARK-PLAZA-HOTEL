import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

export const reportManualAttendanceDto = z.object({
  staffId: z.string().uuid(),
  movement: z.enum(['Ingreso', 'Salida']),
  occurredAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().uuid(),
}).strict();
export const parseReportManualAttendanceDto = (data: unknown) => parseZodHttp(reportManualAttendanceDto, data, 'Datos de asistencia manual inválidos');

export const reportBiometricAttendanceDto = z.object({
  staffId: z.string().uuid(),
  deviceId: z.string().uuid(),
  bridgeOperationId: z.string().max(64),
  templateReference: z.string().min(1).max(255),
  movement: z.enum(['Ingreso', 'Salida']),
  occurredAt: z.coerce.date(),
  idempotencyKey: z.string().uuid().optional(), // Or we can use bridgeOperationId
}).strict();
export const parseReportBiometricAttendanceDto = (data: unknown) => parseZodHttp(reportBiometricAttendanceDto, data, 'Datos de asistencia biométrica inválidos');

export const bridgeCapabilityDto = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('health') }).strict(),
  z.object({ operation: z.enum(['enroll', 'verify']), subjectType: z.enum(['client', 'employee']), subjectId: z.string().uuid() }).strict(),
]);
export const parseBridgeCapabilityDto = (data: unknown) => parseZodHttp(bridgeCapabilityDto, data, 'Datos de capacidad biométrica inválidos');

export const submitCorrectionDto = z.object({
  attendanceEventId: z.string().uuid(),
  correctionType: z.string().trim().min(1).max(64),
  proposedValues: z.record(z.string(), z.any()),
  reason: z.string().trim().min(1).max(255),
}).strict();
export const parseSubmitCorrectionDto = (data: unknown) => parseZodHttp(submitCorrectionDto, data, 'Datos de corrección inválidos');

export const approveCorrectionDto = z.object({
  approved: z.boolean(),
  notes: z.string().trim().max(255).optional(),
}).strict();
export const parseApproveCorrectionDto = (data: unknown) => parseZodHttp(approveCorrectionDto, data, 'Datos de decisión inválidos');

export const reportQrAttendanceDto = z.object({
  qrToken: z.string().trim().min(10),
  staffId: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(500).optional().default(10),
  movement: z.enum(['Ingreso', 'Salida']).optional(),
  idempotencyKey: z.string().uuid(),
}).strict();
export const parseReportQrAttendanceDto = (data: unknown) => parseZodHttp(reportQrAttendanceDto, data, 'Datos de asistencia QR inválidos');
