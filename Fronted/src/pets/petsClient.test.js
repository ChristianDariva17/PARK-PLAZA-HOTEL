import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPet, fetchPets, PetRequestError } from './petsClient.js';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('pet persistence client', () => {
  it('returns only server-confirmed responses', async () => {
    const response = { id: 'PET-001' };
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => response,
    });
    await expect(createPet({ id: 'PET-001' })).resolves.toBe(response);
  });

  it('surfaces normalized failures instead of swallowing them', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'private detail' }),
    });
    const error = await fetchPets().then(
      () => { throw new Error('Expected fetchPets to reject'); },
      (error) => error,
    );
    expect(error).toBeInstanceOf(PetRequestError);
    expect(error).toMatchObject({
      name: 'PetRequestError',
      message: 'Revise los datos y vínculos de la mascota.',
      status: 400,
      reloadRecommended: false,
    });
    expect(error).not.toMatchObject({ message: 'private detail' });
  });
});
