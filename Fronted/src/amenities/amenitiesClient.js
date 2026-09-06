import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class AmenityRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'AmenityRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

const normalize = (error, fallbackMessage) => {
  const status = error instanceof AuthRequestError ? error.status : null;
  if (status === 400 || status === 422) return new AmenityRequestError('Revise los datos ingresados para la reserva.', status);
  if (status === 401) return new AmenityRequestError('La sesión venció. Inicie sesión nuevamente.', status);
  if (status === 403) return new AmenityRequestError('No cuenta con permiso para realizar esta operación.', status);
  if ([404, 409].includes(status)) return new AmenityRequestError('La reserva o configuración de la zona cambió. Actualice antes de reintentar.', status, true);
  return new AmenityRequestError(fallbackMessage, status, true);
};

async function request(url, options, fallbackMessage) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw normalize(error, fallbackMessage);
  }
}

export async function fetchAmenityReservations(signal) {
  const reservations = await request('/api/amenities/reservations', { signal }, 'No se pudieron cargar las reservas de piscina y mirador.');
  if (!Array.isArray(reservations)) throw new AmenityRequestError('No se pudieron cargar las reservas de piscina y mirador.', null, true);
  return reservations;
}

export async function fetchAmenityConfigs(signal) {
  const configs = await request('/api/amenities/config', { signal }, 'No se pudo cargar la configuración de las zonas.');
  if (!Array.isArray(configs)) throw new AmenityRequestError('El servidor devolvió una configuración de zonas no válida.', null, true);
  return configs;
}

export async function updateAmenityConfig(payload) {
  return request('/api/amenities/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'No se pudo actualizar la configuración de la zona.');
}

export async function fetchAmenityOccupancy(signal) {
  const occupancy = await request('/api/amenities/occupancy', { signal }, 'No se pudo cargar el aforo de las zonas.');
  if (!occupancy || typeof occupancy !== 'object' || Array.isArray(occupancy)) throw new AmenityRequestError('El servidor devolvió un aforo de zonas no válido.', null, true);
  return occupancy;
}

export async function createManualAmenityPass(payload) {
  return request('/api/amenities/reservations/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'No se pudo registrar el pase de acceso.');
}

export async function checkInAmenityPass(reservationId) {
  return request(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/checkin`, {
    method: 'POST',
  }, 'No se pudo registrar el ingreso del visitante.');
}

export async function fetchAmenityReservationTab(reservationId, signal) {
  return request(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/tab`, { signal }, 'No se pudo cargar el detalle de la cuenta de consumos.');
}

export async function updateAmenityReservationIdentity(reservationId, payload) {
  return request(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/identity`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, 'No se pudo actualizar el DNI/titular de la reserva.');
}

export async function settleAmenityReservation(reservationId, payload) {
  return request(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/settle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'No se pudo liquidar la cuenta de la reserva.');
}

export async function fetchAmenityBlocks(signal) {
  const blocks = await request('/api/amenities/blocks', { signal }, 'No se pudieron cargar los bloqueos de zonas.');
  if (!Array.isArray(blocks)) throw new AmenityRequestError('El servidor devolvió bloqueos de zonas no válidos.', null, true);
  return blocks;
}

export async function createAmenityBlock(payload) {
  return request('/api/amenities/blocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'No se pudo registrar el bloqueo de zona.');
}
