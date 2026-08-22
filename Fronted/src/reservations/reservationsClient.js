import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class ReservationRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false, code = null, ambiguous = false) {
    super(message);
    this.name = 'ReservationRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

export const createReservationCancellationError = () => new ReservationRequestError('La operación fue reemplazada porque los datos de reservas cambiaron. Revise la información e intente nuevamente.', null, false, 'superseded');

function normalizeReservationError(error) {
  if (!(error instanceof AuthRequestError)) return new ReservationRequestError('No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.', null, true, 'ambiguous', true);
  if (error.status === 400) return new ReservationRequestError('Revise las fechas, la capacidad y los datos seleccionados.', 400);
  if (error.status === 401) return new ReservationRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new ReservationRequestError('No cuenta con permiso para realizar esta operación.', 403);
  if (error.status === 404) return new ReservationRequestError('La habitación o el huésped ya no está disponible. Actualice los datos.', 404, true);
  if (error.status === 409) return new ReservationRequestError('La habitación ya no está disponible para el intervalo seleccionado.', 409, true);
  if (!error.status || error.status >= 500) return new ReservationRequestError('No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.', error.status ?? null, true, 'ambiguous', true);
  return new ReservationRequestError('No se pudo completar la operación. Intente nuevamente.', error.status);
}

async function reservationRequest(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    if (options?.signal?.aborted) throw createReservationCancellationError();
    throw normalizeReservationError(error);
  }
}

export const getReservations = (signal) => reservationRequest('/api/reservations', { signal });

export function getReservationAvailability(query, signal) {
  const parameters = new URLSearchParams({ checkInAt: query.checkInAt, checkOutAt: query.checkOutAt, guestCount: String(query.guestCount) });
  return reservationRequest(`/api/reservations/availability?${parameters}`, { signal });
}

export const createReservation = (body, signal) => reservationRequest('/api/reservations', { method: 'POST', body: JSON.stringify(body), signal });
