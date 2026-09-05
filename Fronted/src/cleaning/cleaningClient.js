import { AuthRequestError, authRequest } from '../auth/authClient.js';

export class CleaningRequestError extends Error {
  constructor(message, status = null, reloadRecommended = false, code = null, ambiguous = false) {
    super(message);
    this.name = 'CleaningRequestError';
    this.status = status;
    this.reloadRecommended = reloadRecommended;
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

export const createCleaningCancellationError = () =>
  new CleaningRequestError(
    'La operación fue reemplazada porque los datos de limpieza cambiaron. Actualice la información antes de reintentar.',
    null,
    false,
    'superseded',
  );

function normalize(error) {
  if (!(error instanceof AuthRequestError))
    return new CleaningRequestError(
      'No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.',
      null,
      true,
      'ambiguous',
      true,
    );
  if (error.status === 400) return new CleaningRequestError('Revise los datos de la tarea de limpieza.', 400);
  if (error.status === 401) return new CleaningRequestError('La sesión venció. Inicie sesión nuevamente.', 401);
  if (error.status === 403) return new CleaningRequestError('No cuenta with permiso para realizar esta operación.', 403);
  if ([404, 409].includes(error.status))
    return new CleaningRequestError(
      'La tarea de limpieza o la habitación ya cambió. Actualice los datos.',
      error.status,
      true,
    );
  return new CleaningRequestError(
    'No se pudo confirmar la operación. Se actualizarán los datos antes de permitir otro intento.',
    error.status ?? null,
    true,
    'ambiguous',
    true,
  );
}

async function request(url, options) {
  try {
    return await authRequest(url, options);
  } catch (error) {
    if (options?.signal?.aborted) throw createCleaningCancellationError();
    throw normalize(error);
  }
}

const command = (url, method, { body, key, signal } = {}) =>
  request(url, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { 'Idempotency-Key': key },
    signal,
  });

export const createCleaningIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export const getCleaningTasks = (signal) => request('/api/cleaning', { signal });
export const createCleaningTask = (body, key, signal) => command(`/api/cleaning`, 'POST', { body, key, signal });
export const updateCleaningTask = (taskId, body, key, signal) => command(`/api/cleaning/${taskId}`, 'PATCH', { body, key, signal });
export const progressCleaningTask = (taskId, body, key, signal) => command(`/api/cleaning/${taskId}/progress`, 'POST', { body, key, signal });
export const reportCleaningIncident = (taskId, body, key, signal) => command(`/api/cleaning/${taskId}/incident`, 'POST', { body, key, signal });
