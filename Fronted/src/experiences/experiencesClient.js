import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class ExperiencesRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'ExperiencesRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

const normalize = (error) => {
  const status = error instanceof AuthRequestError ? error.status : null;
  if (status === 400) return new ExperiencesRequestError('Revise los datos de la experiencia o participación.', 400);
  if (status === 401) return new ExperiencesRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (status === 403) return new ExperiencesRequestError('No cuenta con permiso para esta operación.', 403);
  if ([404, 409].includes(status)) return new ExperiencesRequestError('El registro cambió. Actualice antes de reintentar.', status, true);
  return new ExperiencesRequestError('No se pudo confirmar la operación. Actualice antes de reintentar.', status, true);
};

const propertyPath = (propertyId, suffix) => {
  if (!propertyId) throw new ExperiencesRequestError('No active property is available for experiences.', null, false);
  return `/api/properties/${encodeURIComponent(propertyId)}/experiences${suffix}`;
};

async function request(url, options = {}) {
  try { return await authRequest(url, options); } catch (error) { throw normalize(error); }
}

export async function fetchExperiences(propertyId, signal) {
  return await request(propertyPath(propertyId, ''), { signal });
}

export async function createExperience(propertyId, payload, signal) {
  return await request(propertyPath(propertyId, ''), {
    method: 'POST',
    body: JSON.stringify(payload), signal
  });
}

export async function updateExperience(propertyId, id, payload, signal) {
  return await request(propertyPath(propertyId, `/${encodeURIComponent(id)}`), {
    method: 'PUT',
    body: JSON.stringify(payload), signal
  });
}

export async function fetchParticipations(propertyId, experienceId, signal) {
  return await request(propertyPath(propertyId, `/${encodeURIComponent(experienceId)}/participations`), { signal });
}

export async function registerParticipation(propertyId, experienceId, payload, signal) {
  return await request(propertyPath(propertyId, `/${encodeURIComponent(experienceId)}/participations`), {
    method: 'POST',
    body: JSON.stringify(payload), signal
  });
}
