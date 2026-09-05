import { authRequest } from '../auth/authClient.js';

export const auditClient = {
  listAuditEvents: async (page = 1, limit = 50, filters = {}) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.subjectType) params.append('subjectType', filters.subjectType);
    if (filters.subjectId) params.append('subjectId', filters.subjectId);
    if (filters.actorAccountId) params.append('actorAccountId', filters.actorAccountId);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.search) params.append('search', filters.search);
    return authRequest(`/api/documents/audit?${params.toString()}`);
  }
};
