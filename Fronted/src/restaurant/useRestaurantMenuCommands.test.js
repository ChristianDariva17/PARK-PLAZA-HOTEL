import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { applyMenuImport, createMenuItem, previewMenuImport, updateMenuItem } from './restaurantClient.js';
import { createRestaurantMenuCommands } from './useRestaurantMenuCommands.js';

vi.mock('./restaurantClient.js', () => ({
  applyMenuImport: vi.fn(),
  archiveMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  getManagedMenu: vi.fn(),
  previewMenuImport: vi.fn(),
  reactivateMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
}));

const managementPermissions = [PERMISSIONS.kitchenCreate, PERMISSIONS.kitchenUpdate, PERMISSIONS.kitchenArchive];
const menuItem = { id: 'menu-1', name: 'Coffee', category: 'Bebidas', salePrice: '12.50', ingredients: [] };

describe('restaurant menu commands', () => {
  const commitInternal = vi.fn();
  const reloadManagedMenu = vi.fn();
  const reloadResource = vi.fn();
  const cancelMenuImport = vi.fn();
  const menuImportControllerRef = { current: null };
  let currentState;

  const createCommands = () => createRestaurantMenuCommands({
    getPermissions: () => managementPermissions,
    getState: () => currentState,
    commitInternal,
    reloadManagedMenu,
    reloadResource,
    cancelMenuImport,
    menuImportControllerRef,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    reloadManagedMenu.mockResolvedValue([]);
    reloadResource.mockResolvedValue(null);
    currentState = { menuImportRequest: { contentHash: 'hash-1' }, menuPendingMutations: [] };
  });

  it('commits a manual item and refreshes managed and operational menus', async () => {
    vi.mocked(createMenuItem).mockResolvedValue(menuItem);
    const commands = createCommands();

    await expect(commands.createManual({ name: 'Coffee' })).resolves.toMatchObject({ id: 'menu-1', salePrice: 12.5 });

    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'MENU_ITEM_COMMITTED' }));
    expect(reloadManagedMenu).toHaveBeenCalled();
    expect(reloadResource).toHaveBeenCalledWith('menu');
    expect(reloadResource).toHaveBeenCalledWith('orders');
  });

  it('clears an item mutation in finally when update fails', async () => {
    vi.mocked(updateMenuItem).mockRejectedValue(new Error('conflict'));
    const commands = createCommands();

    await expect(commands.updateManual('menu-1', {})).rejects.toThrow('conflict');

    expect(commitInternal).toHaveBeenNthCalledWith(1, { type: 'MENU_MUTATION_STARTED', itemId: 'menu-1' });
    expect(commitInternal).toHaveBeenLastCalledWith({ type: 'MENU_MUTATION_DONE', itemId: 'menu-1' });
  });

  it('stores preview state and applies only the matching preview hash', async () => {
    vi.mocked(previewMenuImport).mockResolvedValue({ runId: 'run-1', mode: 'preview', sourceDigest: 'digest-1' });
    vi.mocked(applyMenuImport).mockResolvedValue({ runId: 'run-2', mode: 'apply', sourceDigest: 'digest-1' });
    const commands = createCommands();

    await commands.previewImport('# Menu', 'hash-1');
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'MENU_IMPORT_PREVIEW_DONE', contentHash: 'hash-1' }));

    await commands.applyImport('# Menu', 'hash-1');
    expect(applyMenuImport).toHaveBeenCalledWith({ markdown: '# Menu' }, expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'MENU_IMPORT_APPLY_DONE' }));
  });

  it('rejects an import when the preview hash is stale', async () => {
    const commands = createCommands();

    await expect(commands.applyImport('# Changed menu', 'hash-2')).rejects.toThrow('previsualización vigente');

    expect(applyMenuImport).not.toHaveBeenCalled();
  });
});
