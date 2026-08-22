import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class PetRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'PetRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

const normalize = (error) => {
  const status = error instanceof AuthRequestError ? error.status : null;
  if (status === 400) return new PetRequestError('Revise los datos y vínculos de la mascota.', 400);
  if (status === 401) return new PetRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (status === 403) return new PetRequestError('No cuenta con permiso para esta operación.', 403);
  if ([404, 409].includes(status)) return new PetRequestError('El registro de mascota cambió. Actualice antes de reintentar.', status, true);
  return new PetRequestError('No se pudo confirmar la operación de mascota. Actualice antes de reintentar.', status, true);
};

async function request(url, options = {}) {
  try { return await authRequest(url, options); } catch (error) { throw normalize(error); }
}

export async function fetchPets(signal) {
  return await request('/api/pets', { signal });
}

export async function createPet(payload, signal) {
  return await request('/api/pets', {
    method: 'POST',
    body: JSON.stringify(payload), signal
  });
}

export async function updatePet(id, payload, signal) {
  return await request(`/api/pets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload), signal
  });
}

export async function archivePet(id, reason, signal) {
  return await request(`/api/pets/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ reason }), signal
  });
}

export async function reactivatePet(id, reason, signal) {
  return await request(`/api/pets/${id}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ reason }), signal
  });
}
