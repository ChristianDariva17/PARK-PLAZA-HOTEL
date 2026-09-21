import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { setRoomBlocked, updateRoom, updateRoomCategory } from './roomsClient.js';
import { createRoomCommands } from './useRoomCommands.js';

vi.mock('./roomsClient.js', () => ({
  createRoomCancellationError: vi.fn(() => new Error('superseded')),
  getRooms: vi.fn(),
  RoomRequestError: class RoomRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
  setRoomBlocked: vi.fn(),
  updateRoom: vi.fn(),
  updateRoomCategory: vi.fn(),
}));

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '550e8400-e29b-41d4-a716-446655440001';
const category = {
  id: categoryId,
  code: 'STD',
  name: 'Simple',
  capacity: 2,
  baseNightlyRate: '95.00',
  createdAt: '2026-09-15T00:00:00.000Z',
};
const room = {
  id: roomId,
  number: '101',
  floor: 1,
  status: 'Disponible',
  categoryId,
};
const roomResponse = {
  id: roomId,
  number: '102',
  floor: 2,
  status: 'available',
  createdAt: '2026-09-15T00:00:00.000Z',
  category,
};

describe('room commands', () => {
  const commitInternal = vi.fn();
  const cancelRoomRequest = vi.fn();
  const reloadRooms = vi.fn();
  const generationRef = { current: 0 };
  const roomControllerRef = { current: null };
  const projectedState = { current: { rooms: [room], roomCategories: [category] } };
  const permissions = [PERMISSIONS.roomsRead, PERMISSIONS.roomsUpdate, PERMISSIONS.roomsBlock];

  const createCommands = (currentPermissions = permissions) => createRoomCommands({
    authStatus: 'authenticated',
    permissions: currentPermissions,
    commitInternal,
    projectedState,
    cancelRoomRequest,
    reloadRooms,
    generationRef,
    roomControllerRef,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    generationRef.current = 0;
    roomControllerRef.current = null;
    reloadRooms.mockResolvedValue({ rooms: [room], categories: [category] });
  });

  it('updates a room through the client and commits the adapted response', async () => {
    vi.mocked(updateRoom).mockResolvedValue(roomResponse);
    const commands = createCommands();

    await expect(commands.update(roomId, { number: '102', floor: '2', categoryId })).resolves.toMatchObject({ id: roomId, number: '102' });

    expect(updateRoom).toHaveBeenCalledWith(roomId, { number: '102', floor: 2 }, expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'ROOM_MUTATION_STARTED' }));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'ROOM_MUTATION_COMMITTED' }));
  });

  it('blocks a room and updates a category with their dedicated permissions', async () => {
    vi.mocked(setRoomBlocked).mockResolvedValue({ ...roomResponse, status: 'blocked' });
    vi.mocked(updateRoomCategory).mockResolvedValue({ ...category, name: 'Suite' });
    const commands = createCommands();

    await expect(commands.setBlocked(roomId, true, 'Mantenimiento')).resolves.toMatchObject({ status: 'Bloqueada' });
    await expect(commands.updateCategory(categoryId, { ...category, name: 'Suite' })).resolves.toMatchObject({ name: 'Suite' });

    expect(setRoomBlocked).toHaveBeenCalledWith(roomId, { blocked: true, reason: 'Mantenimiento' }, expect.any(AbortSignal));
    expect(updateRoomCategory).toHaveBeenCalledWith(categoryId, { name: 'Suite' });
  });

  it('rejects room mutations without the required permission', async () => {
    const commands = createCommands([PERMISSIONS.roomsRead]);

    expect(() => commands.update(roomId, { number: '102', floor: '2', categoryId })).toThrow('No cuenta con permiso');
    expect(updateRoom).not.toHaveBeenCalled();
  });
});
