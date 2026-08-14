import type { FastifyRequest } from 'fastify';

export interface AuthenticatedAccount {
  accountId: string;
  propertyId: string;
  roleKey: string;
  email: string;
  permissions: string[];
  sessionId: string;
  passwordChangeRequired: boolean;
}

export type AuthenticatedRequest = FastifyRequest & { auth?: AuthenticatedAccount };

export interface RequestContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}
