import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class StayRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false, code = null, ambiguous = false) { super(message); this.name = 'StayRequestError'; this.status = status; this.reloadRecommended = reloadRecommended; this.code = code; this.ambiguous = ambiguous; }
}
export const createStayCancellationError = () => new StayRequestError('La operación fue reemplazada porque los datos de recepción cambiaron. Actualice la información antes de reintentar.', null, false, 'superseded');
function normalize(error) {
  if (!(error instanceof AuthRequestError)) return new StayRequestError('No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.', null, true, 'ambiguous', true);
  if (error.status === 400) return new StayRequestError('Revise el intervalo y los datos de la operación.', 400);
  if (error.status === 401) return new StayRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new StayRequestError('No cuenta con permiso para realizar esta operación.', 403);
  if ([404, 409].includes(error.status)) return new StayRequestError('La reserva, estadía o habitación ya cambió. Actualice los datos.', error.status, true);
  return new StayRequestError('No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.', error.status ?? null, true, 'ambiguous', true);
}
async function request(url, options) {
  try { return await authRequest(url, options); } catch (error) { if (options?.signal?.aborted) throw createStayCancellationError(); throw normalize(error); }
}
const command = (url, { body, key, signal } = {}) => request(url, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}), headers: { 'Idempotency-Key': key }, signal });
export const getPersistentStays = (signal) => request('/api/stays', { signal });
export const checkInReservation = (reservationId, body, key, signal) => command(`/api/stays/reservation/${reservationId}/check-in`, { body, key, signal });
export const checkOutStay = (stayId, key, signal, body = {}) => command(`/api/stays/${stayId}/check-out`, { body, key, signal });
export const createWalkIn = (body, key, signal) => command('/api/stays/walk-in', { body, key, signal });
export const completeRoomCleaning = (roomId, key, signal) => command(`/api/stays/rooms/${roomId}/cleaning-complete`, { key, signal });
