import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { getInitialHotelState } from '../domain/hotelModel.js';
import { createPet } from './petsClient.js';
import { createPetCommands } from './usePetCommands.js';

vi.mock('./petsClient.js', () => ({
  PetRequestError: class PetRequestError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  archivePet: vi.fn(),
  createPet: vi.fn(),
  fetchPets: vi.fn(),
  reactivatePet: vi.fn(),
  updatePet: vi.fn(),
}));

describe('pet commands', () => {
  const authRef = { current: { authStatus: 'authenticated', permissions: [PERMISSIONS.petsCreate] } };
  const projectedState = { current: getInitialHotelState() };
  const commitInternal = vi.fn();
  const requestGenerationRef = { current: 0 };
  const requestControllerRef = { current: null };

  beforeEach(() => {
    vi.clearAllMocks();
    authRef.current.permissions = [PERMISSIONS.petsCreate];
    requestGenerationRef.current = 0;
    vi.mocked(createPet).mockResolvedValue({ id: 'PET-001', name: 'Milo', type: 'Perro', size: 'Mediano', charge: '0.00', status: 'Activa' });
  });

  it('validates and persists a visitor pet through the confirmed request policy', async () => {
    const commands = createPetCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef });
    const action = {
      type: 'PET_CREATE',
      payload: { originType: 'visitor', ownerName: 'Luis', name: 'Milo', type: 'Perro', size: 'Mediano', lodgingPlace: 'Habitación', charge: '0' },
    };

    await expect(commands.execute(action)).resolves.toMatchObject({ id: 'PET-001', name: 'Milo', charge: 0 });

    expect(createPet).toHaveBeenCalledWith(expect.objectContaining({ id: 'PET-001', ownerName: 'Luis', name: 'Milo', charge: 0 }), expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'PET_RECORD_COMMITTED' }));
  });

  it('rejects pet mutations without the action permission', async () => {
    authRef.current.permissions = [];
    const commands = createPetCommands({ authRef, projectedState, commitInternal, requestGenerationRef, requestControllerRef });

    await expect(commands.execute({ type: 'PET_CREATE', payload: { ownerName: 'Luis', name: 'Milo', charge: 0 } })).rejects.toMatchObject({ status: 403 });
    expect(createPet).not.toHaveBeenCalled();
  });
});
