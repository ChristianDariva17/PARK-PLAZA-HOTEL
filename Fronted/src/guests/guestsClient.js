import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class GuestRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false, code = null) {
    super(message);
    this.name = 'GuestRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
    this.code = code;
  }
}

export const createGuestCancellationError = () => new GuestRequestError('La operación fue cancelada porque los datos cambiaron. Revise la información e intente nuevamente.', null, false, 'superseded');

function normalizeGuestError(error) {
  if (!(error instanceof AuthRequestError)) return new GuestRequestError('No se pudo completar la operación. Intente nuevamente.');
  if (error.status === 400) return new GuestRequestError('Los datos no son válidos o el huésped archivado no admite cambios.', 400);
  if (error.status === 401) return new GuestRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new GuestRequestError('No cuenta con permiso para realizar esta operación.', 403);
  if (error.status === 404) return new GuestRequestError('El huésped ya no está disponible. Actualice la lista antes de continuar.', 404, true);
  if (error.status === 409) return new GuestRequestError('El documento de identidad ya está en uso.', 409);
  return new GuestRequestError(error.status ? 'No se pudo completar la operación. Intente nuevamente.' : 'No se pudo conectar con el servidor. Intente nuevamente.', error.status);
}

async function guestRequest(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    throw normalizeGuestError(error);
  }
}

export const getGuests = (signal) => guestRequest('/api/guests', { signal });
export const createGuest = (body) => guestRequest('/api/guests', { method: 'POST', body: JSON.stringify(body) });
export const updateGuest = (guestId, body) => guestRequest(`/api/guests/${guestId}`, { method: 'PATCH', body: JSON.stringify(body) });
