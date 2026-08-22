import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class CashRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'CashRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

function normalize(error) {
  if (!(error instanceof AuthRequestError))
    return new CashRequestError('No se pudo completar la operación de caja. Verifique la conexión.', null, true);
  if (error.status === 400) return new CashRequestError('Datos de caja inválidos.', 400);
  if (error.status === 401) return new CashRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new CashRequestError('No tiene permisos para esta operación de caja.', 403);
  if (error.status === 409)
    return new CashRequestError(error.message || 'Conflicto al operar la caja (¿caja ya abierta o cerrada?).', 409, true);
  return new CashRequestError('Error inesperado al operar la caja.', error.status ?? null, true);
}

async function request(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    throw normalize(error);
  }
}

export const getActiveCashSession = (signal) => request('/api/cash/session/active', { signal });

export const getCashSessions = (signal) => request('/api/cash/sessions', { signal });

export const getCashMovements = (sessionId, signal) => request(`/api/cash/movements/${sessionId}`, { signal });

export const openCashSession = (body, signal) =>
  request('/api/cash/session/open', { method: 'POST', body: JSON.stringify(body), signal });

export const countCashSession = (sessionId, body, signal) =>
  request(`/api/cash/session/count/${sessionId}`, { method: 'POST', body: JSON.stringify(body), signal });

export const closeCashSession = (sessionId, body, signal) =>
  request(`/api/cash/session/close/${sessionId}`, { method: 'POST', body: JSON.stringify(body), signal });

export const createCashMovement = (body, signal) =>
  request('/api/cash/movements', { method: 'POST', body: JSON.stringify(body), signal });
