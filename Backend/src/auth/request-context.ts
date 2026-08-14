import type { FastifyRequest } from 'fastify';
import type { RequestContext } from './auth.types.js';

export function getRequestContext(request: FastifyRequest): RequestContext {
  const userAgent = request.headers['user-agent'];
  return {
    requestId: String(request.id),
    ipAddress: request.ip,
    ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
  };
}
