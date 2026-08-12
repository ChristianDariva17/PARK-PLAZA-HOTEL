const bridgeUrl = (import.meta.env.VITE_ZK_BRIDGE_URL || 'http://127.0.0.1:17345').replace(/\/$/, '');
const bridgeToken = import.meta.env.VITE_ZK_BRIDGE_TOKEN || '';
const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

let healthCache = null;

export class ZkBridgeError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ZkBridgeError';
    this.code = code;
    this.status = status;
  }
}

const delay = (milliseconds, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new DOMException('Operation aborted', 'AbortError'));
  }, { once: true });
});

async function request(path, { method = 'GET', body, signal, timeoutMs = 5000 } = {}) {
  if (!bridgeToken) throw new ZkBridgeError('bridge_not_configured', 'VITE_ZK_BRIDGE_TOKEN is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${bridgeUrl}${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': bridgeToken,
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ZkBridgeError(payload.error?.code || 'bridge_request_failed', payload.error?.message || 'Bridge request failed.', response.status);
    return payload;
  } catch (error) {
    if (error.name === 'AbortError' && !signal?.aborted) throw new ZkBridgeError('bridge_timeout', 'The bridge did not respond in time.');
    if (error instanceof ZkBridgeError || error.name === 'AbortError') throw error;
    throw new ZkBridgeError('bridge_unavailable', 'The local fingerprint bridge is unavailable.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function getBridgeHealth({ signal, force = false } = {}) {
  if (!force && healthCache && Date.now() - healthCache.createdAt < 5000) return Promise.resolve(healthCache.value);
  return request('/api/v1/health', { signal }).then((value) => {
    healthCache = { createdAt: Date.now(), value };
    return value;
  });
}

export async function runBiometricOperation(kind, subject, { signal, onProgress, timeoutMs = 30000 } = {}) {
  let operation = await request(`/api/v1/${kind}`, {
    method: 'POST',
    body: { ...subject, timeoutMs },
    signal,
  });
  onProgress?.(operation);

  try {
    while (!terminalStatuses.has(operation.status)) {
      await delay(450, signal);
      operation = await request(`/api/v1/operations/${operation.operationId}`, { signal });
      onProgress?.(operation);
    }
  } catch (error) {
    if (signal?.aborted && operation.operationId) {
      request(`/api/v1/operations/${operation.operationId}`, { method: 'DELETE', timeoutMs: 2000 }).catch(() => {});
    }
    throw error;
  }

  if (operation.status === 'failed') throw new ZkBridgeError(operation.error?.code || 'operation_failed', operation.error?.message || 'Fingerprint operation failed.');
  if (operation.status === 'cancelled') throw new ZkBridgeError('operation_cancelled', 'Fingerprint operation was cancelled.');
  return operation;
}
