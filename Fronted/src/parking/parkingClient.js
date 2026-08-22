import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class ParkingRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'ParkingRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

const normalize = (error) => {
  const status = error instanceof AuthRequestError ? error.status : null;
  if (status === 400) return new ParkingRequestError('Revise los datos y vínculos del vehículo.', 400);
  if (status === 401) return new ParkingRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (status === 403) return new ParkingRequestError('No cuenta con permiso para esta operación.', 403);
  if ([404, 409].includes(status)) return new ParkingRequestError('El registro de cochera cambió. Actualice antes de reintentar.', status, true);
  return new ParkingRequestError('No se pudo confirmar la operación de cochera. Actualice antes de reintentar.', status, true);
};

async function request(url, options = {}) {
  try { return await authRequest(url, options); } catch (error) { throw normalize(error); }
}

export async function fetchVehicles(signal) {
  return await request('/api/parking', { signal });
}

export async function createVehicle(payload, signal) {
  return await request('/api/parking', {
    method: 'POST',
    body: JSON.stringify(payload), signal
  });
}

export async function updateVehicle(id, payload, signal) {
  return await request(`/api/parking/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload), signal
  });
}

export async function exitVehicle(id, payload, signal) {
  return await request(`/api/parking/${id}/exit`, {
    method: 'POST',
    body: JSON.stringify(payload), signal
  });
}

export async function archiveVehicle(id, reason, signal) {
  return await request(`/api/parking/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ reason }), signal
  });
}
