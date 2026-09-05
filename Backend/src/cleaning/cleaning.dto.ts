import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

const createCleaningTaskSchema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().trim().min(1).max(255).optional(),
  observation: z.string().trim().max(2000).optional(),
  assignedTo: z.string().trim().max(100).optional(),
}).strict();

const updateCleaningTaskSchema = z.object({
  assignedTo: z.string().trim().min(1).max(100).optional(),
  observation: z.string().trim().max(2000).optional(),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const progressCleaningTaskSchema = z.object({
  expectedStatus: z.enum(['pending', 'in_progress', 'completed', 'approved']).optional(),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const createIncidentSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  responsible: z.string().trim().min(1).max(100).optional(),
  blocksRoom: z.boolean().optional().default(false),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const idempotencyKeySchema = z.string().uuid();

export type CreateCleaningTaskDto = z.output<typeof createCleaningTaskSchema>;
export type UpdateCleaningTaskDto = z.output<typeof updateCleaningTaskSchema>;
export type ProgressCleaningTaskDto = z.output<typeof progressCleaningTaskSchema>;
export type CreateIncidentDto = z.output<typeof createIncidentSchema>;

export const parseCreateCleaningTaskDto = (input: unknown) => parseZodHttp(createCleaningTaskSchema, input);
export const parseUpdateCleaningTaskDto = (input: unknown) => parseZodHttp(updateCleaningTaskSchema, input);
export const parseProgressCleaningTaskDto = (input: unknown) => parseZodHttp(progressCleaningTaskSchema, input);
export const parseCreateIncidentDto = (input: unknown) => parseZodHttp(createIncidentSchema, input);
export const parseCleaningTaskId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid cleaning task ID');
export const parseIdempotencyKey = (input: unknown) => parseZodHttp(idempotencyKeySchema, input, 'Invalid or missing idempotency key');

