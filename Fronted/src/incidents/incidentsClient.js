import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class IncidentRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'IncidentRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

function normalize(error) {
  if (!(error instanceof AuthRequestError))
    return new IncidentRequestError('No se pudo confirmar la operacion. Actualice antes de reintentar.', null, true);
  if (error.status === 400) return new IncidentRequestError('Revise los datos de la incidencia.', 400);
  if (error.status === 401) return new IncidentRequestError('La sesion vencio. Inicie sesion nuevamente.', 401);
  if (error.status === 403) return new IncidentRequestError('No cuenta con permiso para esta operacion.', 403);
  if ([404, 409].includes(error.status))
    return new IncidentRequestError('La incidencia o habitacion ya cambio. Actualice los datos.', error.status, true);
  return new IncidentRequestError('Error al confirmar la operacion. Actualice antes de reintentar.', error.status ?? null, true);
}

async function request(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    throw normalize(error);
  }
}

export const getIncidents = (signal) => request('/api/incidents', { signal });

export const createIncident = (body, signal) =>
  request('/api/incidents', { method: 'POST', body: JSON.stringify(body), signal });

export const updateIncident = (id, body, signal) =>
  request(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal });

export const progressIncident = (id, body, signal) =>
  request(`/api/incidents/${id}/progress`, { method: 'POST', body: JSON.stringify(body), signal });
