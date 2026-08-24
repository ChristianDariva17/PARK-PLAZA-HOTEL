import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class ReceivableRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) { super(message); this.name = 'ReceivableRequestError'; this.status = status; this.reloadRecommended = reloadRecommended; }
}
const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
function normalize(error) {
  if (!(error instanceof AuthRequestError)) return new ReceivableRequestError('No se pudo confirmar la operación. Actualizá antes de reintentar.', null, true);
  if (error.status === 400) return new ReceivableRequestError('Revisá los datos de la cobranza.', 400);
  if (error.status === 403) return new ReceivableRequestError('No tenés permiso para esta operación financiera.', 403);
  if ([404, 409].includes(error.status)) return new ReceivableRequestError('La cuenta por cobrar cambió. Actualizá antes de reintentar.', error.status, true);
  return new ReceivableRequestError('No se pudo completar la operación financiera.', error.status ?? null, true);
}
async function request(url, options = {}) { try { return await authRequest(url, options); } catch (error) { throw normalize(error); } }
export const getReceivables = (filters = {}, signal) => { const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); return request(`/api/receivables${query.size ? `?${query}` : ''}`, { signal }); };
export const getReceivable = (id, signal) => request(`/api/receivables/${id}`, { signal });
export const collectReceivable = (id, body, idempotencyKey = key()) => request(`/api/receivables/${id}/collections`, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } });
export const reverseReceivableCollection = (id, entryId, body, idempotencyKey = key()) => request(`/api/receivables/${id}/collections/${entryId}/reverse`, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } });
