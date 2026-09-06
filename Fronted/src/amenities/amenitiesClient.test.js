import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAmenityConfigs, fetchAmenityReservations, updateAmenityConfig } from './amenitiesClient.js';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('amenity reservations client', () => {
  it('rejects an empty successful response instead of returning null to the view', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => 'application/json' },
    });

    await expect(fetchAmenityReservations()).rejects.toThrow('No se pudieron cargar las reservas de piscina y mirador.');
  });

  it('does not represent a failed configuration load as an empty collection', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(fetchAmenityConfigs()).rejects.toMatchObject({
      name: 'AmenityRequestError',
      status: 503,
      reloadRecommended: true,
    });
  });

  it('preserves actionable conflict metadata for configuration updates', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Conflict' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(updateAmenityConfig({ amenityKey: 'piscina' })).rejects.toMatchObject({
      name: 'AmenityRequestError',
      status: 409,
      reloadRecommended: true,
    });
  });
});
