import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class MaintenanceRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'MaintenanceRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

function normalize(error) {
  if (!(error instanceof AuthRequestError))
    return new MaintenanceRequestError('No se pudo confirmar la operacion. Actualice antes de reintentar.', null, true);
  if (error.status === 400) return new MaintenanceRequestError('Revise los datos del ticket.', 400);
  if (error.status === 401) return new MaintenanceRequestError('La sesion vencio. Inicie sesion nuevamente.', 401);
  if (error.status === 403) return new MaintenanceRequestError('No cuenta con permiso para esta operacion.', 403);
  if ([404, 409].includes(error.status))
    return new MaintenanceRequestError('El ticket o habitacion ya cambio. Actualice los datos.', error.status, true);
  return new MaintenanceRequestError('Error al confirmar la operacion. Actualice antes de reintentar.', error.status ?? null, true);
}

async function request(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    throw normalize(error);
  }
}

export const getMaintenanceTickets = (signal) => request('/api/maintenance', { signal });

export const createMaintenanceTicket = (body, signal) =>
  request('/api/maintenance', { method: 'POST', body: JSON.stringify(body), signal });

export const updateMaintenanceTicket = (id, body, signal) =>
  request(`/api/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(body), signal });

export const progressMaintenanceTicket = (id, body, signal) =>
  request(`/api/maintenance/${id}/progress`, { method: 'POST', body: JSON.stringify(body), signal });
