import { authRequest } from '../auth/authClient.js';

const idempotencyKey = () => globalThis.crypto?.randomUUID?.() || (() => { throw new Error('Secure random UUID is unavailable'); })();

const commandOptions = (data = {}) => {
  const { idempotencyKey: key, ...body } = data;
  return {
    headers: { 'Idempotency-Key': key || idempotencyKey() },
    body: JSON.stringify(body),
  };
};

export const evidenceClient = {
  registerEvidence: async (data) => {
    return authRequest('/api/documents/evidences', {
      method: 'POST',
      ...commandOptions(data),
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
