import { authRequest } from '../auth/authClient.js';

export const documentsClient = {
  createContract: async (data) => {
    return authRequest('/api/documents/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listContracts: async (page = 1, limit = 50, status = '', reference = '') => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    if (reference) params.append('reference', reference);
    return authRequest(`/api/documents/contracts?${params.toString()}`);
  },

  getContract: async (id) => {
    return authRequest(`/api/documents/contracts/${id}`);
  },

  transitionContract: async (id, data) => {
    return authRequest(`/api/documents/contracts/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  linkEvidence: async (id, data) => {
    return authRequest(`/api/documents/contracts/${id}/link-evidence`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  registerEvidence: async (data) => {
    return authRequest('/api/documents/evidences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listAuditEvents: async (page = 1, limit = 50, filters = {}) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.subjectType) params.append('subjectType', filters.subjectType);
    if (filters.subjectId) params.append('subjectId', filters.subjectId);
    return authRequest(`/api/documents/audit?${params.toString()}`);
  }
};
