const REQUEST_ERROR_TYPES = new Set([
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'server',
  'network',
  'ambiguous',
  'invalid_response',
]);

const normalizeType = (type) => type === 'invalid-response' ? 'invalid_response' : type;

export class RequestError extends Error {
  constructor(message, options = {}) {
    const normalizedOptions = typeof options === 'number' ? { status: options } : options;
    const {
      status = null,
      code = 'transport',
      type = null,
      retryable = false,
      ambiguous = false,
      reloadRecommended = false,
      requestId = null,
      fieldErrors = null,
      cause,
      known = false,
    } = normalizedOptions || {};

    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
    this.type = type;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.reloadRecommended = reloadRecommended;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
    this.known = known;
  }
}

export function isRequestError(error) {
  return error instanceof RequestError || error?.name?.endsWith('RequestError');
}

export function getRequestErrorType(error) {
  const directType = normalizeType(error?.type);
  if (REQUEST_ERROR_TYPES.has(directType)) return directType;

  const status = error?.status == null ? null : Number(error.status);
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return error?.ambiguous ? 'ambiguous' : 'server';
  if (error?.code === 'invalid_response') return 'invalid_response';
  if (status == null || status === 0) return 'network';
  return 'invalid_response';
}

export function normalizeRequestError(error) {
  if (!error) return null;

  const type = getRequestErrorType(error);
  const known = isRequestError(error);
  const message = known && typeof error.message === 'string' && error.message.trim()
    ? error.message
    : 'No se pudo completar la solicitud. Intentá nuevamente.';
  const status = error.status == null || !Number.isFinite(Number(error.status)) ? null : Number(error.status);
  const code = typeof error.code === 'string' && error.code.length <= 100 ? error.code : type;
  const requestId = typeof error.requestId === 'string' && error.requestId.length <= 100 ? error.requestId : null;

  return Object.freeze({
    message,
    status,
    code,
    type,
    retryable: Boolean(error.retryable),
    ambiguous: Boolean(error.ambiguous || type === 'ambiguous'),
    reloadRecommended: Boolean(error.reloadRecommended),
    requestId,
    fieldErrors: error.fieldErrors || null,
  });
}
