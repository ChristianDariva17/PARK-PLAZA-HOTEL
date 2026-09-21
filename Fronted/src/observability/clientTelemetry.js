import { subscribeRequestTelemetry } from '../auth/authClient.js';

const TELEMETRY_URL = '/api/observability/client-events';
const SAFE_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const SAFE_KINDS = new Set(['request', 'websocket', 'chunk', 'performance']);
const SAFE_OUTCOMES = new Set(['failure', 'connected', 'disconnected', 'error', 'measured']);
const SAFE_METRICS = new Set(['lcp', 'inp', 'cls']);
const PERFORMANCE_LIMITS = { lcp: 60_000, inp: 60_000, cls: 10 };
let stopTelemetry;

export function sanitizeClientTelemetry(event = {}) {
  const kind = SAFE_KINDS.has(event.kind) ? event.kind : 'request';
  const outcome = SAFE_OUTCOMES.has(event.outcome) ? event.outcome : 'failure';
  const route = sanitizeRoute(event.path || event.route);
  const statusCode = Number.isInteger(event.statusCode ?? event.status) && (event.statusCode ?? event.status) >= 0 && (event.statusCode ?? event.status) <= 599
    ? (event.statusCode ?? event.status)
    : null;
  const attempt = Number.isInteger(event.attempt) && event.attempt >= 0 && event.attempt <= 1 ? event.attempt : 0;
  const metric = SAFE_METRICS.has(event.metric) ? event.metric : null;
  const numericValue = typeof event.value === 'number' ? event.value : Number.NaN;
  const value = metric && Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= PERFORMANCE_LIMITS[metric]
    ? Number(numericValue.toFixed(3))
    : null;
  return {
    kind,
    outcome,
    method: SAFE_METHODS.has(event.method) ? event.method : 'GET',
    route,
    statusCode,
    attempt,
    code: typeof event.code === 'string' ? event.code.slice(0, 64).replace(/[^a-zA-Z0-9_.-]/g, '_') : null,
    requestId: typeof event.requestId === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(event.requestId) ? event.requestId : null,
    metric,
    value,
  };
}

export function reportClientTelemetry(event) {
  if (typeof navigator === 'undefined') return;
  const payload = JSON.stringify(sanitizeClientTelemetry(event));
  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(TELEMETRY_URL, new Blob([payload], { type: 'application/json' }))) return;
  } catch {
    // Fall through to keepalive fetch when Beacon is unavailable.
  }
  if (typeof fetch === 'function') {
    void fetch(TELEMETRY_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function startClientTelemetry() {
  if (stopTelemetry) return stopTelemetry;
  const cleanups = [subscribeRequestTelemetry(reportClientTelemetry), ...startWebVitals()];
  const handleError = (event) => {
    const message = event?.reason?.message || event?.error?.message || event?.message || '';
    if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(String(message))) {
      reportClientTelemetry({ kind: 'chunk', outcome: 'error', path: globalThis.location?.pathname, code: 'chunk_load_error' });
    }
  };
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('error', handleError);
    globalThis.addEventListener('unhandledrejection', handleError);
    cleanups.push(() => globalThis.removeEventListener('error', handleError));
    cleanups.push(() => globalThis.removeEventListener('unhandledrejection', handleError));
  }
  stopTelemetry = () => {
    cleanups.forEach((cleanup) => cleanup());
    stopTelemetry = undefined;
  };
  return stopTelemetry;
}

function startWebVitals() {
  if (typeof document === 'undefined' || typeof globalThis.PerformanceObserver !== 'function') return [];

  const supportedEntryTypes = new Set(globalThis.PerformanceObserver.supportedEntryTypes || []);
  const cleanups = [];
  const values = { lcp: null, inp: null, cls: null };
  let clsWindowStart = 0;
  let clsWindowEnd = 0;
  let clsWindowValue = 0;
  const reported = new Set();

  const observe = (type, onEntry) => {
    if (supportedEntryTypes.size && !supportedEntryTypes.has(type)) return;
    try {
      const observer = new globalThis.PerformanceObserver((list) => {
        list.getEntries().forEach(onEntry);
      });
      observer.observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
      cleanups.push(() => observer.disconnect());
    } catch {
      // Unsupported performance entries must not affect application startup.
    }
  };

  observe('largest-contentful-paint', (entry) => {
    values.lcp = Math.max(values.lcp || 0, entry.startTime);
  });
  observe('event', (entry) => {
    if (entry.interactionId && entry.duration) values.inp = Math.max(values.inp || 0, entry.duration);
  });
  observe('layout-shift', (entry) => {
    if (entry.hadRecentInput) return;
    if (entry.startTime - clsWindowStart > 1_000 || entry.startTime - clsWindowEnd > 500) {
      clsWindowStart = entry.startTime;
      clsWindowValue = entry.value;
    } else {
      clsWindowValue += entry.value;
    }
    clsWindowEnd = entry.startTime;
    values.cls = Math.max(values.cls || 0, clsWindowValue);
  });

  const flush = () => {
    Object.entries(values).forEach(([metric, value]) => {
      if (reported.has(metric) || value === null) return;
      reported.add(metric);
      reportClientTelemetry({ kind: 'performance', outcome: 'measured', metric, value, path: globalThis.location?.pathname });
    });
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  globalThis.addEventListener?.('pagehide', flush);
  cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));
  cleanups.push(() => globalThis.removeEventListener?.('pagehide', flush));

  return cleanups;
}

function sanitizeRoute(path) {
  const normalizedPath = String(path || '');
  if (normalizedPath === '/' || normalizedPath === '') return '/';
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments[0] === 'api') return `/${segments.slice(0, 2).join('/')}`;
  return `/${segments[0] || 'unknown'}`;
}
