import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAmenityReservations } from './amenitiesClient.js';

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
});
