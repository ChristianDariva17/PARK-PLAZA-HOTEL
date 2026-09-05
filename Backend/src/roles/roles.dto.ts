import { z } from 'zod';
import { parseZodHttp } from '../http/zod-parser.js';

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,64}$/, 'La clave debe tener entre 2 y 64 caracteres alfanuméricos en minúsculas, guiones o guiones bajos').optional(),
  permissions: z.array(z.string().trim()).optional().default([]),
}).strict();

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  permissions: z.array(z.string().trim()).optional(),
}).strict();

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const parseCreateRoleDto = (input: unknown): CreateRoleDto => parseZodHttp(createRoleSchema, input, 'Datos de creación de rol inválidos');
export const parseUpdateRoleDto = (input: unknown): UpdateRoleDto => parseZodHttp(updateRoleSchema, input, 'Datos de actualización de rol inválidos');
export const parseRoleId = (input: unknown): string => parseZodHttp(z.string().uuid(), input, 'ID de rol inválido');
