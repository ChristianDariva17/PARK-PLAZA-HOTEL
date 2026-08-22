import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVehicle, fetchVehicles, ParkingRequestError } from './parkingClient.js';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('parking persistence client', () => {
  it('returns only server-confirmed responses', async () => {
    const response = { id: 'VEH-001' };
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => response,
    });
    await expect(createVehicle({ id: 'VEH-001' })).resolves.toBe(response);
  });

  it('surfaces normalized failures instead of swallowing them', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'private detail' }),
    });
    const error = await fetchVehicles().then(
      () => { throw new Error('Expected fetchVehicles to reject'); },
      (error) => error,
    );
    expect(error).toBeInstanceOf(ParkingRequestError);
    expect(error).toMatchObject({
      name: 'ParkingRequestError',
      message: 'El registro de cochera cambió. Actualice antes de reintentar.',
      status: 409,
      reloadRecommended: true,
    });
    expect(error).not.toMatchObject({ message: 'private detail' });
  });
});
