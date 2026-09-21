import { normalizeRequestError } from './requestError.js';

export const RESOURCE_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  REFRESHING: 'refreshing',
  SUCCESS: 'success',
  EMPTY: 'empty',
  STALE: 'stale',
  ERROR: 'error',
  FORBIDDEN: 'forbidden',
  OFFLINE: 'offline',
  RECONCILING: 'reconciling',
});

const SUCCESS_STATUSES = new Set([RESOURCE_STATUS.SUCCESS, RESOURCE_STATUS.EMPTY, RESOURCE_STATUS.STALE]);

export const isResourceLoading = (status) => status === RESOURCE_STATUS.LOADING || status === RESOURCE_STATUS.REFRESHING;

export const statusForCollection = (data) => Array.isArray(data) && data.length === 0 ? RESOURCE_STATUS.EMPTY : RESOURCE_STATUS.SUCCESS;

export function createResourceSnapshot({
  status = RESOURCE_STATUS.IDLE,
  data = [],
  error = null,
  errorDetails = null,
  updatedAt = null,
  permission = null,
} = {}) {
  const normalizedError = errorDetails || (error && typeof error !== 'string' ? normalizeRequestError(error) : null);
  const message = typeof error === 'string' ? error : normalizedError?.message || null;
  const isLoading = isResourceLoading(status);
  const isError = status === RESOURCE_STATUS.ERROR || status === RESOURCE_STATUS.OFFLINE;
  const isEmpty = status === RESOURCE_STATUS.EMPTY || (status === RESOURCE_STATUS.SUCCESS && Array.isArray(data) && data.length === 0);

  return {
    status,
    data,
    error: message,
    errorDetails: normalizedError,
    updatedAt,
    permission,
    loading: isLoading,
    isLoading,
    isRefreshing: status === RESOURCE_STATUS.REFRESHING,
    isError,
    isForbidden: status === RESOURCE_STATUS.FORBIDDEN,
    isUnavailable: status === RESOURCE_STATUS.OFFLINE,
    isSuccess: SUCCESS_STATUSES.has(status) || (status === RESOURCE_STATUS.REFRESHING && Array.isArray(data) && data.length > 0),
    isEmpty,
    isIdle: status === RESOURCE_STATUS.IDLE,
  };
}
