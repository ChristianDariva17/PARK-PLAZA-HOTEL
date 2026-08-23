import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class FolioRequestError extends Error { constructor(message, reloadRecommended = false) { super(message); this.name = 'FolioRequestError'; this.reloadRecommended = reloadRecommended; } }
const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
async function request(url, options) {
  try { return await authRequest(url, options); }
  catch (error) {
    if (!(error instanceof AuthRequestError)) throw new FolioRequestError('Folio outcome is ambiguous. Refresh before retrying.', true);
    if ([404, 409].includes(error.status)) throw new FolioRequestError('The folio changed. Refresh before retrying.', true);
    throw new FolioRequestError(error.status === 403 ? 'You do not have permission for this folio action.' : 'Folio action was rejected.');
  }
}
const command = (stayId, path, body, idempotencyKey = key()) => request(`/api/stays/${stayId}/folio/${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } });
export const getFolio = (stayId, signal) => request(`/api/stays/${stayId}/folio`, { signal });
export const createFolioCharge = (stayId, body, idempotencyKey) => command(stayId, 'charges', body, idempotencyKey);
export const createFolioPayment = (stayId, body, idempotencyKey) => command(stayId, 'payments', body, idempotencyKey);
export const reverseFolioEntry = (stayId, entryId, body, idempotencyKey) => command(stayId, `entries/${entryId}/reverse`, body, idempotencyKey);
