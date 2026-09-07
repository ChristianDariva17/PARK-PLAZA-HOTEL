const SESSION_URL = '/api/auth/session';

let initialSessionRequest;
const unauthorizedListeners = new Set();
const requestTelemetryListeners = new Set();

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
  constructor(message, options = {}, legacyKnown = false) {
    const { status = null, code = 'transport', retryable = false, ambiguous = false, reloadRecommended = false, requestId = null, cause, known = legacyKnown } = typeof options === 'number' ? { status: options } : options;
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.reloadRecommended = reloadRecommended;
    this.requestId = requestId;
    this.known = known;
  }
}

const RESOURCE_ERROR_CODES = new Map([
  [401, 'session'], [403, 'forbidden'], [404, 'absent'], [409, 'reconcile'], [422, 'validation'],
]);

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export function normalizeResourceError(error) {
  if (error instanceof AuthRequestError) return Object.freeze({ code: error.code, status: error.status, retry: error.retryable, requestId: error.requestId });
  return Object.freeze({ code: 'transport', status: null, retry: true, requestId: null });
}

export function serializeExactMoney(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.\d{2}$/.test(value)) throw new TypeError('Money must be an exact decimal string with two fractional digits.');
  return value;
}

export function createIdempotencyKey() {
  const key = globalThis.crypto?.randomUUID?.();
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new Error('This browser cannot create a required idempotency key.');
  }
  return key;
}

export function createKeyedCommand(command, key = createIdempotencyKey()) {
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

export function subscribeRequestTelemetry(listener) {
  requestTelemetryListeners.add(listener);
  return () => requestTelemetryListeners.delete(listener);
}

async function readErrorPayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {};
  try {
    const payload = await response.json();
    return {
      message: typeof payload?.message === 'string' && payload.message.length <= 200 ? payload.message : null,
      code: typeof payload?.code === 'string' && payload.code.length <= 100 ? payload.code : null,
      requestId: typeof payload?.requestId === 'string' && payload.requestId.length <= 100 ? payload.requestId : null,
    };
  } catch {
    return {};
  }
}

const delay = (milliseconds, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Operation aborted', 'AbortError')); }, { once: true });
});

const isReadRetry = (method, attempt, signal) => method === 'GET' && attempt === 0 && !signal?.aborted;

function reportFailure({ method, url, error, attempt }) {
  requestTelemetryListeners.forEach((listener) => listener({
    method,
    path: new URL(url, globalThis.location?.origin || 'http://localhost').pathname,
    status: error.status,
    code: error.code,
    requestId: error.requestId,
    attempt,
  }));
}

export async function authRequest(url, options = {}) {
  const { signalUnauthorized = true, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        credentials: 'include',
        ...fetchOptions,
        headers: fetchOptions.body ? { 'Content-Type': 'application/json', ...fetchOptions.headers } : fetchOptions.headers,
      });
    } catch (cause) {
      // Canceled requests are expected during effect cleanup, not connection failures.
      if (cause?.name === 'AbortError') throw cause;
      if (isReadRetry(method, attempt, fetchOptions.signal)) { await delay(100, fetchOptions.signal); continue; }
      const error = new AuthRequestError('No se pudo conectar con el servidor. Intentá nuevamente.', { retryable: method === 'GET', cause });
      reportFailure({ method, url, error, attempt });
      throw error;
    }

    if (!response.ok) {
      const payload = await readErrorPayload(response);
      if (RETRYABLE_STATUSES.has(response.status) && isReadRetry(method, attempt, fetchOptions.signal)) { await delay(100, fetchOptions.signal); continue; }
      const knownMessage = KNOWN_ERROR_MESSAGES.get(payload.message);
      if (response.status === 401 && signalUnauthorized && payload.message !== 'Current password is incorrect') unauthorizedListeners.forEach((listener) => listener());
      const error = new AuthRequestError(knownMessage || 'La solicitud no pudo completarse.', {
        status: response.status,
        code: payload.code || RESOURCE_ERROR_CODES.get(response.status) || `http_${response.status}`,
        retryable: method === 'GET' && RETRYABLE_STATUSES.has(response.status),
        ambiguous: method !== 'GET' && (response.status >= 500 || response.status === 0),
        reloadRecommended: [404, 409].includes(response.status) || (method !== 'GET' && response.status >= 500),
        requestId: payload.requestId,
        known: Boolean(knownMessage),
      });
      reportFailure({ method, url, error, attempt });
      throw error;
    }

    if (response.status === 204) return null;

    try {
      return await response.json();
    } catch (cause) {
      const error = new AuthRequestError('El servidor devolvió una respuesta no válida. Intentá nuevamente.', { code: 'invalid_response', retryable: false, cause });
      reportFailure({ method, url, error, attempt });
      throw error;
    }
  }

  throw new Error('Unreachable request retry state.');
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
      throw new AuthRequestError('El correo electrónico o la contraseña son incorrectos.', { status: 401, code: 'invalid_credentials' });
    }
    if (error instanceof AuthRequestError && error.status === 429) {
      throw new AuthRequestError('Se realizaron demasiados intentos. Esperá unos minutos antes de volver a intentar.', { status: 429, code: 'rate_limited' });
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
