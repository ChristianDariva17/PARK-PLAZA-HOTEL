import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

const createMaintenanceSchema = z.object({
  roomId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  responsible: z.string().trim().min(1).max(100).optional(),
  blocksRoom: z.boolean().optional().default(false),
  evidence: z.string().trim().max(2_000_000).optional(),
}).strict();

const updateMaintenanceSchema = z.object({
  description: z.string().trim().min(1).max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  responsible: z.string().trim().min(1).max(100).optional(),
  solution: z.string().trim().max(2000).optional(),
  evidence: z.string().trim().max(2_000_000).optional(),
  blocksRoom: z.boolean().optional(),
}).strict();

const progressMaintenanceSchema = z.object({
  action: z.enum(['assign', 'start', 'resolve', 'close', 'reopen']),
  expectedStatus: z.enum(['pending', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  responsible: z.string().trim().min(1).max(100).optional(),
  solution: z.string().trim().min(1).max(2000).optional(),
  evidence: z.string().trim().max(2_000_000).optional(),
  releaseRoom: z.boolean().optional().default(false),
}).strict().superRefine((value, context) => {
  if (value.action === 'assign' && !value.responsible) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['responsible'], message: 'Responsible is required when assigning a ticket' });
  }
  if (value.action === 'resolve' && !value.solution) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['solution'], message: 'Solution is required when resolving a ticket' });
  }
  if (value.action !== 'close' && value.releaseRoom) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['releaseRoom'], message: 'A room can only be released when closing a ticket' });
  }
});

const idempotencyKeySchema = z.string().uuid();

export type CreateMaintenanceDto = z.output<typeof createMaintenanceSchema>;
export type UpdateMaintenanceDto = z.output<typeof updateMaintenanceSchema>;
export type ProgressMaintenanceDto = z.output<typeof progressMaintenanceSchema>;

export const parseCreateMaintenanceDto = (input: unknown) => parseZodHttp(createMaintenanceSchema, input);
export const parseUpdateMaintenanceDto = (input: unknown) => parseZodHttp(updateMaintenanceSchema, input);
export const parseProgressMaintenanceDto = (input: unknown) => parseZodHttp(progressMaintenanceSchema, input);
export const parseMaintenanceId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid maintenance ticket ID');
