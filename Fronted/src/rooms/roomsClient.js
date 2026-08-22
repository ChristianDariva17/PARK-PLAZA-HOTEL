import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class RoomRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false, code = null) {
    super(message);
    this.name = 'RoomRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
    this.code = code;
  }
}

export const createRoomCancellationError = () => new RoomRequestError('La operación fue cancelada porque el inventario cambió. Revise la información e intente nuevamente.', null, false, 'superseded');

function normalizeRoomError(error) {
  if (!(error instanceof AuthRequestError)) return new RoomRequestError('No se pudo completar la operación. Intente nuevamente.');
  if (error.status === 400) return new RoomRequestError('Los datos de la habitación no son válidos.', 400);
  if (error.status === 401) return new RoomRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new RoomRequestError('No cuenta con permiso para realizar esta operación.', 403);
  if (error.status === 404) return new RoomRequestError('La habitación o categoría ya no está disponible. Actualice la lista.', 404, true);
  if (error.status === 409) return new RoomRequestError('El número ya está en uso o el estado actual no permite esta transición.', 409, true);
  return new RoomRequestError(error.status ? 'No se pudo completar la operación. Intente nuevamente.' : 'No se pudo conectar con el servidor. Intente nuevamente.', error.status);
}

async function roomRequest(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    if (options?.signal?.aborted) throw createRoomCancellationError();
    throw normalizeRoomError(error);
  }
}

export const getRooms = (signal) => roomRequest('/api/rooms', { signal });
export const updateRoom = (roomId, body, signal) => roomRequest(`/api/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(body), signal });
export const setRoomBlocked = (roomId, body, signal) => roomRequest(`/api/rooms/${roomId}/block`, { method: 'PATCH', body: JSON.stringify(body), signal });
