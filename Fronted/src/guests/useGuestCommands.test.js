import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { archiveGuest, createGuest, reactivateGuest, updateGuest } from './guestsClient.js';
import { createGuestCommands } from './useGuestCommands.js';

vi.mock('./guestsClient.js', () => ({
  archiveGuest: vi.fn(),
  createGuest: vi.fn(),
  createGuestCancellationError: vi.fn(() => new Error('superseded')),
  getGuests: vi.fn(),
  GuestRequestError: class GuestRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
  reactivateGuest: vi.fn(),
  updateGuest: vi.fn(),
}));

const guestPermissions = [PERMISSIONS.guestsCreate, PERMISSIONS.guestsUpdate, PERMISSIONS.guestsArchive];
const guest = {
  id: 'guest-1',
  firstName: 'Ana',
  lastName: 'Torres',
  primaryDocument: { type: 'dni', issuingCountry: 'PE', documentNumber: '12345678' },
  status: 'Activo',
  visits: 2,
};
const response = {
  id: 'guest-1',
  firstName: 'Ana',
  lastName: 'Torres',
  primaryDocument: { type: 'dni', issuingCountry: 'PE', documentNumber: '12345678', expiresOn: null },
  status: 'active',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
};

describe('guest commands', () => {
  const commitInternal = vi.fn();
  const cancelGuestLoad = vi.fn();
  const reloadGuests = vi.fn();
  const generationRef = { current: 0 };
  const projectedState = { current: { clients: [guest] } };

  const createCommands = (permissions = guestPermissions) => createGuestCommands({
    authStatus: 'authenticated',
    permissions,
    commitInternal,
    projectedState,
    cancelGuestLoad,
    reloadGuests,
    generationRef,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    generationRef.current = 0;
    reloadGuests.mockResolvedValue([]);
  });

  it('creates a guest and commits the adapted response', async () => {
    vi.mocked(createGuest).mockResolvedValue(response);
    const commands = createCommands();

    await expect(commands.create({
      firstName: 'Ana',
      lastName: 'Torres',
      primaryDocument: { type: 'dni', documentNumber: '12345678' },
    })).resolves.toMatchObject({ id: 'guest-1', name: 'Ana Torres' });

    expect(createGuest).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Ana',
      primaryDocument: expect.objectContaining({ type: 'dni', issuingCountry: 'PE' }),
    }));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'GUEST_CREATED_COMMITTED' }));
  });

  it('allows archive and reactivate with the guests archive permission', async () => {
    vi.mocked(archiveGuest).mockResolvedValue({ ...response, status: 'archived' });
    vi.mocked(reactivateGuest).mockResolvedValue(response);
    const commands = createCommands();

    await expect(commands.archive('guest-1')).resolves.toMatchObject({ status: 'Archivado' });
    await expect(commands.reactivate('guest-1')).resolves.toMatchObject({ status: 'Activo' });

    expect(archiveGuest).toHaveBeenCalledWith('guest-1');
    expect(reactivateGuest).toHaveBeenCalledWith('guest-1');
  });

  it('rejects mutations without the mapped permission', async () => {
    const commands = createCommands([PERMISSIONS.guestsRead]);

    await expect(commands.update('guest-1', { ...guest, primaryDocument: guest.primaryDocument })).rejects.toMatchObject({ status: 403 });
    expect(updateGuest).not.toHaveBeenCalled();
  });
});
