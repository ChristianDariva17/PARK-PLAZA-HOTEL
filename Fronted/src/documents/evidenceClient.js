import { authRequest } from '../auth/authClient.js';

export const evidenceClient = {
  registerEvidence: async (data) => {
    return authRequest('/api/documents/evidences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listEvidences: async (page = 1, limit = 50, filters = {}) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (filters.status) params.append('status', filters.status);
    if (filters.source) params.append('source', filters.source);
    if (filters.referenceId) params.append('referenceId', filters.referenceId);
    return authRequest(`/api/documents/evidences?${params.toString()}`);
  }
};
