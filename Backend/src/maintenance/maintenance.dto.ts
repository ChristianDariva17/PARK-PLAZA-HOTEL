import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

const createMaintenanceSchema = z.object({
  roomId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  responsible: z.string().trim().min(1).max(100).optional(),
  blocksRoom: z.boolean().optional().default(false),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const updateMaintenanceSchema = z.object({
  description: z.string().trim().min(1).max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  responsible: z.string().trim().min(1).max(100).optional(),
  solution: z.string().trim().max(2000).optional(),
  evidence: z.string().trim().max(500).optional(),
  blocksRoom: z.boolean().optional(),
}).strict();

const progressMaintenanceSchema = z.object({
  expectedStatus: z.enum(['pending', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const idempotencyKeySchema = z.string().uuid();

export type CreateMaintenanceDto = z.output<typeof createMaintenanceSchema>;
export type UpdateMaintenanceDto = z.output<typeof updateMaintenanceSchema>;
export type ProgressMaintenanceDto = z.output<typeof progressMaintenanceSchema>;

export const parseCreateMaintenanceDto = (input: unknown) => parseZodHttp(createMaintenanceSchema, input);
export const parseUpdateMaintenanceDto = (input: unknown) => parseZodHttp(updateMaintenanceSchema, input);
export const parseProgressMaintenanceDto = (input: unknown) => parseZodHttp(progressMaintenanceSchema, input);
export const parseMaintenanceId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid maintenance ticket ID');
