const SESSION_URL = '/api/auth/session';

let initialSessionRequest;
const unauthorizedListeners = new Set();

const KNOWN_ERROR_MESSAGES = new Map([
  ['Current password is incorrect', 'La contraseña actual es incorrecta.'],
  ['New password must be different', 'La nueva contraseña debe ser diferente de la actual.'],
  ['Password must be at least 12 characters', 'La contraseña debe tener al menos 12 caracteres.'],
  ['Password has appeared in a known data breach', 'La contraseña fue identificada en una filtración conocida. Elegí otra.'],
  ['Password safety service is unavailable', 'No se pudo validar la seguridad de la contraseña. Intentá más tarde.'],
  ['Email or personnel link is already in use', 'El correo o el vínculo de personal ya está en uso.'],
  ['Personnel record is unavailable or already linked', 'El registro de personal no está disponible o ya está vinculado.'],
  ['You cannot disable your own account', 'No podés deshabilitar tu propia cuenta.'],
  ['The last active administrator cannot be disabled or demoted', 'Debe permanecer al menos una cuenta administradora activa.'],
  ['You cannot reset your own password; use change password instead', 'Para tu propia cuenta, usá el cambio de contraseña.'],
  ['Insufficient permissions', 'No tenés permiso para realizar esta operación.'],
  ['Invalid request body', 'Revisá los datos ingresados.'],
  ['Invalid Google credential', 'No se pudo verificar la cuenta de Google. Intentá nuevamente.'],
  ['Google account is disabled', 'Esta cuenta se encuentra deshabilitada.'],
  ['Google access request was rejected', 'Tu solicitud de acceso fue rechazada.'],
  ['Google Sign-In is not configured', 'El inicio con Google todavía no está configurado.'],
  ['Google registration is not configured', 'El registro con Google todavía no está configurado.'],
]);

export class AuthRequestError extends Error {
  constructor(message, status, known = false) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.known = known;
  }
}

const RESOURCE_ERROR_CODES = new Map([
  [401, 'session'], [403, 'forbidden'], [404, 'absent'], [409, 'reconcile'], [422, 'validation'],
]);

export function normalizeResourceError(error) {
  const status = error instanceof AuthRequestError ? error.status : null;
  return Object.freeze({ code: RESOURCE_ERROR_CODES.get(status) || 'transport', status, retry: status === null || status === 404 || status === 409 });
}

export function serializeExactMoney(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.\d{2}$/.test(value)) throw new TypeError('Money must be an exact decimal string with two fractional digits.');
  return value;
}

export function createKeyedCommand(command, key = globalThis.crypto?.randomUUID?.()) {
  if (!key) throw new Error('A stable idempotency key is required.');
  return Object.freeze({ key, run: () => command(key) });
}

export function createResourceRead(request) {
  let generation = 0;
  let controller = null;
  return async () => {
    controller?.abort();
    controller = new AbortController();
    const currentGeneration = ++generation;
    try {
      const value = await request(controller.signal);
      return currentGeneration === generation ? { status: 'settled', value } : { status: 'superseded' };
    } catch (error) {
      if (currentGeneration !== generation || controller.signal.aborted) return { status: 'superseded' };
      throw error;
    }
  };
}

export function subscribeUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    const payload = await response.json();
    return typeof payload?.message === 'string' && payload.message.length <= 200 ? payload.message : null;
  } catch {
    return null;
  }
}

export async function authRequest(url, options = {}) {
  let response;
  const { signalUnauthorized = true, ...fetchOptions } = options;

  try {
    response = await fetch(url, {
      credentials: 'include',
      ...fetchOptions,
      headers: fetchOptions.body ? { 'Content-Type': 'application/json', ...fetchOptions.headers } : fetchOptions.headers,
    });
  } catch (error) {
    // Canceled requests are expected during effect cleanup, not connection failures.
    if (error?.name === 'AbortError') throw error;
    throw new AuthRequestError('No se pudo conectar con el servidor. Intentá nuevamente.');
  }

  if (!response.ok) {
    const backendMessage = await readErrorMessage(response);
    const knownMessage = KNOWN_ERROR_MESSAGES.get(backendMessage);
    if (response.status === 401 && signalUnauthorized && backendMessage !== 'Current password is incorrect') unauthorizedListeners.forEach((listener) => listener());
    throw new AuthRequestError(knownMessage || 'La solicitud no pudo completarse.', response.status, Boolean(knownMessage));
  }

  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch {
    throw new AuthRequestError('El servidor devolvió una respuesta no válida. Intentá nuevamente.');
  }
}

export async function getSession() {
  try {
    return await authRequest(SESSION_URL, { signalUnauthorized: false });
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 401) return null;
    throw error;
  }
}

export function getInitialSession() {
  if (!initialSessionRequest) {
    initialSessionRequest = getSession().catch((error) => {
      initialSessionRequest = undefined;
      throw error;
    });
  }

  return initialSessionRequest;
}

export function resetInitialSession() {
  initialSessionRequest = undefined;
}

export async function loginRequest(email, password) {
  try {
    await authRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      signalUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 401) {
      throw new AuthRequestError('El correo electrónico o la contraseña son incorrectos.', 401);
    }
    if (error instanceof AuthRequestError && error.status === 429) {
      throw new AuthRequestError('Se realizaron demasiados intentos. Esperá unos minutos antes de volver a intentar.', 429);
    }
    throw error;
  }
}

export function googleLoginRequest(credential) {
  return authRequest('/api/auth/google', {
    method: 'POST', body: JSON.stringify({ credential }), signalUnauthorized: false,
  });
}

export function logoutRequest() {
  return authRequest('/api/auth/logout', { method: 'POST' });
}

export function changePasswordRequest(currentPassword, newPassword) {
  return authRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
}
