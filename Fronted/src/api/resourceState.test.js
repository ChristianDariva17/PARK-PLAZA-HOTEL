import { describe, expect, it } from 'vitest';
import { createResourceSnapshot, RESOURCE_STATUS, statusForCollection } from './resourceState.js';

describe('resource state contract', () => {
  it('distinguishes initial loading from a refresh with stale data', () => {
    const initial = createResourceSnapshot({ status: RESOURCE_STATUS.LOADING });
    const refreshing = createResourceSnapshot({ status: RESOURCE_STATUS.REFRESHING, data: [{ id: 'current' }] });

    expect(initial).toMatchObject({ loading: true, isLoading: true, isRefreshing: false, isSuccess: false });
    expect(refreshing).toMatchObject({ loading: true, isLoading: true, isRefreshing: true, isSuccess: true, data: [{ id: 'current' }] });
  });

  it('exposes empty and successful collection states consistently', () => {
    expect(statusForCollection([])).toBe(RESOURCE_STATUS.EMPTY);
    expect(statusForCollection([{ id: 'record' }])).toBe(RESOURCE_STATUS.SUCCESS);
    expect(createResourceSnapshot({ status: RESOURCE_STATUS.EMPTY })).toMatchObject({ isEmpty: true, isSuccess: true, loading: false });
  });

  it('keeps normalized error metadata alongside a safe display message', () => {
    const snapshot = createResourceSnapshot({
      status: RESOURCE_STATUS.ERROR,
      error: 'No se pudo cargar.',
      errorDetails: { type: 'conflict', status: 409, code: 'reconcile', requestId: 'req-1' },
    });

    expect(snapshot).toMatchObject({
      error: 'No se pudo cargar.',
      errorDetails: { type: 'conflict', status: 409, code: 'reconcile', requestId: 'req-1' },
      isError: true,
    });
  });
});
