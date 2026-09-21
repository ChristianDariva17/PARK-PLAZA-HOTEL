import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestError } from '../api/requestError.js';
import { getOrders } from './restaurantClient.js';
import { authRequest } from '../auth/authClient.js';

vi.mock('../auth/authClient.js', () => ({
  authRequest: vi.fn(),
}));

describe('restaurant client error contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves common conflict metadata for resource consumers', async () => {
    vi.mocked(authRequest).mockRejectedValueOnce(new RequestError('Actualización requerida.', {
      status: 409,
      code: 'reconcile',
      reloadRecommended: true,
      requestId: 'req-409',
    }));

    await expect(getOrders()).rejects.toMatchObject({
      name: 'RestaurantRequestError',
      status: 409,
      code: 'reconcile',
      type: 'conflict',
      reloadRecommended: true,
      requestId: 'req-409',
    });
  });

  it('does not convert cancellation into a user-visible server error', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.mocked(authRequest).mockRejectedValueOnce(abortError);

    await expect(getOrders()).rejects.toBe(abortError);
  });

  it('sanitizes unknown transport failures', async () => {
    vi.mocked(authRequest).mockRejectedValueOnce(new Error('database password'));

    await expect(getOrders()).rejects.toMatchObject({
      name: 'RestaurantRequestError',
      message: 'No se pudo completar la solicitud. Intentá nuevamente.',
      type: 'network',
    });
  });
});
