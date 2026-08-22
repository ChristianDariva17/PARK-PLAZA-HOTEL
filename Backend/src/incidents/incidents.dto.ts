import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

const uuid = z.string().uuid();

const createIncidentSchema = z.object({
  type: z.enum(['cleaning', 'maintenance']),
  roomId: z.string().uuid().optional(),
  referenceId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  responsible: z.string().trim().min(1).max(100).optional(),
  blocksRoom: z.boolean().optional().default(false),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const updateIncidentSchema = z.object({
  description: z.string().trim().min(1).max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  responsible: z.string().trim().min(1).max(100).optional(),
  solution: z.string().trim().max(2000).optional(),
  evidence: z.string().trim().max(500).optional(),
  blocksRoom: z.boolean().optional(),
}).strict();

const progressIncidentSchema = z.object({
  expectedStatus: z.enum(['pending', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  evidence: z.string().trim().max(500).optional(),
}).strict();

const idempotencyKeySchema = z.string().uuid();

export type CreateIncidentDto = z.output<typeof createIncidentSchema>;
export type UpdateIncidentDto = z.output<typeof updateIncidentSchema>;
export type ProgressIncidentDto = z.output<typeof progressIncidentSchema>;

export const parseCreateIncidentDto = (input: unknown) => parseZodHttp(createIncidentSchema, input);
export const parseUpdateIncidentDto = (input: unknown) => parseZodHttp(updateIncidentSchema, input);
export const parseProgressIncidentDto = (input: unknown) => parseZodHttp(progressIncidentSchema, input);
export const parseIncidentId = (input: unknown) => parseZodHttp(uuid, input, 'Invalid incident ID');
export const parseIdempotencyKey = (input: unknown) => parseZodHttp(idempotencyKeySchema, input, 'Invalid or missing idempotency key');
