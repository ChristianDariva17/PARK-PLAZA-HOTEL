import { authRequest } from '../auth/authClient.js';

const BASE = '/api/restaurant';

// ─── Menu ─────────────────────────────────────────────────────────────────────
export const getMenu = (signal) => authRequest(`${BASE}/menu`, { signal });
export const createMenuItem = (body, signal) => authRequest(`${BASE}/menu`, { method: 'POST', body: JSON.stringify(body), signal });
export const updateMenuItem = (id, body, signal) => authRequest(`${BASE}/menu/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal });
export const archiveMenuItem = (id, body, signal) => authRequest(`${BASE}/menu/${id}/archive`, { method: 'POST', body: JSON.stringify(body), signal });

// ─── Inventory ────────────────────────────────────────────────────────────────
export const getInventory = (signal) => authRequest(`${BASE}/inventory`, { signal });
export const getInventoryLedger = (signal) => authRequest(`${BASE}/inventory/ledger`, { signal });
export const createInventoryItem = (body, signal) => authRequest(`${BASE}/inventory`, { method: 'POST', body: JSON.stringify(body), signal });
export const updateInventoryItem = (id, body, signal) => authRequest(`${BASE}/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal });
export const adjustInventory = (id, body, signal) => authRequest(`${BASE}/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(body), signal });
export const archiveInventoryItem = (id, body, signal) => authRequest(`${BASE}/inventory/${id}/archive`, { method: 'POST', body: JSON.stringify(body), signal });

// ─── Orders ───────────────────────────────────────────────────────────────────
export const getOrders = (signal) => authRequest(`${BASE}/orders`, { signal });
export const createOrder = (body, signal) => authRequest(`${BASE}/orders`, { method: 'POST', body: JSON.stringify(body), signal });
export const updateOrder = (id, body, signal) => authRequest(`${BASE}/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal });
export const advanceOrder = (id, body, signal) => authRequest(`${BASE}/orders/${id}/advance`, { method: 'POST', body: JSON.stringify(body), signal });
export const cancelOrder = (id, body, signal) => authRequest(`${BASE}/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify(body), signal });

export class RestaurantRequestError extends Error {
  constructor(message, data) {
    super(message);
    this.name = 'RestaurantRequestError';
    this.data = data;
  }
}
