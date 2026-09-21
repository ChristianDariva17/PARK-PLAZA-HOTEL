import { authRequest } from '../auth/authClient.js';
import { normalizeRequestError, RequestError } from '../api/requestError.js';

const BASE = '/api/restaurant';

export class RestaurantRequestError extends RequestError {
  constructor(message, options = {}, originalError = null) {
    super(message, options);
    this.name = 'RestaurantRequestError';
    this.originalError = originalError;
  }
}

const withNormalizedErrors = async (requestPromise) => {
  try {
    return await requestPromise;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const normalized = normalizeRequestError(error);
    throw new RestaurantRequestError(normalized.message, normalized, error);
  }
};

// ─── Menu ─────────────────────────────────────────────────────────────────────
export const getMenu = (signal) => withNormalizedErrors(authRequest(`${BASE}/menu`, { signal }));
export const createMenuItem = (body, signal) => withNormalizedErrors(authRequest(`${BASE}/menu`, { method: 'POST', body: JSON.stringify(body), signal }));
export const updateMenuItem = (id, body, signal) => withNormalizedErrors(authRequest(`${BASE}/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal }));
export const archiveMenuItem = (id, body, signal) => withNormalizedErrors(authRequest(`${BASE}/menu/${id}/archive`, { method: 'POST', body: JSON.stringify(body), signal }));
export const reactivateMenuItem = (id, signal) => withNormalizedErrors(authRequest(`${BASE}/menu/${id}/reactivate`, { method: 'POST', signal }));

// ─── Inventory ────────────────────────────────────────────────────────────────
export const getInventory = (signal) => withNormalizedErrors(authRequest(`${BASE}/inventory`, { signal }));
export const getInventoryLedger = (signal) => withNormalizedErrors(authRequest(`${BASE}/inventory/ledger`, { signal }));
export const createInventoryItem = (body, signal) => withNormalizedErrors(authRequest(`${BASE}/inventory`, { method: 'POST', body: JSON.stringify(body), signal }));
export const updateInventoryItem = (id, body, signal) => withNormalizedErrors(authRequest(`${BASE}/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal }));
export const adjustInventory = (id, body, signal) => withNormalizedErrors(authRequest(`${BASE}/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(body), signal }));
export const archiveInventoryItem = (id, body, signal) => withNormalizedErrors(authRequest(`${BASE}/inventory/${id}/archive`, { method: 'POST', body: JSON.stringify(body), signal }));
export const reactivateInventoryItem = (id, signal) => withNormalizedErrors(authRequest(`${BASE}/inventory/${id}/reactivate`, { method: 'POST', signal }));

// ─── Menu (Internal — Admin) ──────────────────────────────────────────────────
export const getManagedMenu = (signal) => withNormalizedErrors(authRequest(`${BASE}/internal/menu`, { signal }));
export const previewMenuImport = (body, signal) => withNormalizedErrors(authRequest(`${BASE}/internal/menu-imports/preview`, { method: 'POST', body: JSON.stringify(body), signal }));
export const applyMenuImport = (body, signal) => withNormalizedErrors(authRequest(`${BASE}/internal/menu-imports/apply`, { method: 'POST', body: JSON.stringify(body), signal }));

// ─── Orders ───────────────────────────────────────────────────────────────────
export const getOrders = (signal) => withNormalizedErrors(authRequest(`${BASE}/orders`, { signal }));
export const createOrder = (body, idempotencyKey, signal) => withNormalizedErrors(authRequest(`${BASE}/orders`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal }));
export const updateOrder = (id, body, idempotencyKey, signal) => withNormalizedErrors(authRequest(`${BASE}/orders/${id}`, { method: 'PATCH', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal }));
export const advanceOrder = (id, body, idempotencyKey, signal) => withNormalizedErrors(authRequest(`${BASE}/orders/${id}/advance`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal }));
export const advanceOrderItem = (orderId, itemId, body, idempotencyKey, signal) => withNormalizedErrors(authRequest(`${BASE}/orders/${orderId}/items/${itemId}/advance`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal }));
export const cancelOrder = (id, body, idempotencyKey, signal) => withNormalizedErrors(authRequest(`${BASE}/orders/${id}/cancel`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal }));
