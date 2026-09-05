import type { FastifyRequest } from 'fastify';

export interface AuthenticatedCustomer {
  customerAccountId: string;
  propertyId: string;
  sessionId: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
}

export type CustomerAuthenticatedRequest = FastifyRequest & { customer?: AuthenticatedCustomer };
