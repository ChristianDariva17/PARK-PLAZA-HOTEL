import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class CommunicationsRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false) {
    super(message);
    this.name = 'CommunicationsRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
  }
}

const normalize = (error) => {
  const status = error instanceof AuthRequestError ? error.status : null;
  if (status === 400) return new CommunicationsRequestError('Revise los datos de la notificación o preferencia.', 400);
  if (status === 401) return new CommunicationsRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (status === 403) return new CommunicationsRequestError('No cuenta con permiso para esta operación.', 403);
  if ([404, 409].includes(status)) return new CommunicationsRequestError('El registro cambió. Actualice antes de reintentar.', status, true);
  return new CommunicationsRequestError('No se pudo confirmar la operación de comunicaciones. Actualice antes de reintentar.', status, true);
};

const propertyPath = (propertyId, suffix) => {
  if (!propertyId) throw new CommunicationsRequestError('No active property is available for communications.', null, false);
  return `/api/properties/${encodeURIComponent(propertyId)}/communications${suffix}`;
};

async function request(url, options = {}) {
  try { return await authRequest(url, options); } catch (error) { throw normalize(error); }
}

export async function fetchNotifications(propertyId, queryParams = {}, signal) {
  const searchParams = new URLSearchParams();
  if (queryParams.page) searchParams.append('page', queryParams.page);
  if (queryParams.limit) searchParams.append('limit', queryParams.limit);
  if (queryParams.unreadOnly) searchParams.append('unreadOnly', 'true');

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return await request(propertyPath(propertyId, `/notifications${qs}`), { signal });
}

export async function markNotificationRead(propertyId, id, isRead = true, signal) {
  return await request(propertyPath(propertyId, `/notifications/${encodeURIComponent(id)}/read`), {
    method: 'POST',
    body: JSON.stringify({ isRead }),
    signal,
  });
}

export async function markAllNotificationsRead(propertyId, signal) {
  return await request(propertyPath(propertyId, '/notifications/read-all'), {
    method: 'POST',
    signal,
  });
}

export async function clearReadNotifications(propertyId, signal) {
  return await request(propertyPath(propertyId, '/notifications/clear-read'), {
    method: 'POST',
    signal,
  });
}

export async function fetchPreferences(propertyId, signal) {
  return await request(propertyPath(propertyId, '/preferences'), { signal });
}

export async function updatePreference(propertyId, payload, signal) {
  return await request(propertyPath(propertyId, '/preferences'), {
    method: 'PUT',
    body: JSON.stringify(payload),
    signal,
  });
}
