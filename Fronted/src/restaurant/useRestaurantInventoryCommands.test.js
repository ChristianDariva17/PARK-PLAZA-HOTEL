import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { adjustInventory, archiveInventoryItem, createInventoryItem, updateInventoryItem } from './restaurantClient.js';
import { createRestaurantInventoryCommands } from './useRestaurantInventoryCommands.js';

vi.mock('./restaurantClient.js', () => ({
  adjustInventory: vi.fn(),
  archiveInventoryItem: vi.fn(),
  createInventoryItem: vi.fn(),
  reactivateInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
}));

const inventoryItem = {
  id: 'inventory-1',
  name: 'Coffee',
  unit: 'Kg',
  stock: '4',
  reserved: '1',
  minimum: '2',
  cost: '10.50',
};

describe('restaurant inventory commands', () => {
  const commitInternal = vi.fn();
  const reloadResource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    reloadResource.mockResolvedValue(null);
  });

  it('commits a created item and refreshes inventory and menu', async () => {
    vi.mocked(createInventoryItem).mockResolvedValue(inventoryItem);
    const commands = createRestaurantInventoryCommands({
      permissions: [PERMISSIONS.inventoryCreate],
      commitInternal,
      reloadResource,
    });

    await expect(commands.createItem({ name: 'Coffee' })).resolves.toMatchObject({ id: 'inventory-1', available: 3 });

    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RESTAURANT_INVENTORY_ITEM_CREATED',
      item: expect.objectContaining({ id: 'inventory-1' }),
    }));
    expect(reloadResource).toHaveBeenCalledWith('inventory');
    expect(reloadResource).toHaveBeenCalledWith('menu');
  });

  it('rejects a command before calling the client without permission', async () => {
    const commands = createRestaurantInventoryCommands({ commitInternal, reloadResource });

    await expect(commands.updateItem('inventory-1', {})).rejects.toThrow('Sin permiso para editar insumos.');

    expect(updateInventoryItem).not.toHaveBeenCalled();
    expect(commitInternal).not.toHaveBeenCalled();
  });

  it('refreshes the ledger after archive and adjustment mutations', async () => {
    vi.mocked(archiveInventoryItem).mockResolvedValue({ ...inventoryItem, status: 'Archivado' });
    vi.mocked(adjustInventory).mockResolvedValue({ ...inventoryItem, stock: '5' });
    const commands = createRestaurantInventoryCommands({
      permissions: [PERMISSIONS.inventoryArchive, PERMISSIONS.inventoryAdjust],
      commitInternal,
      reloadResource,
    });

    await commands.archiveItem('inventory-1', { reason: 'Discontinued' });
    await commands.adjustStock('inventory-1', { quantity: 1, type: 'Entrada' });

    expect(reloadResource).toHaveBeenCalledWith('inventoryLedger');
    expect(commitInternal).toHaveBeenCalledTimes(2);
    expect(commitInternal).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED' }));
  });

  it('uses the update client and returns the adapted item', async () => {
    vi.mocked(updateInventoryItem).mockResolvedValue({ ...inventoryItem, name: 'Arabica coffee' });
    const commands = createRestaurantInventoryCommands({
      permissions: [PERMISSIONS.inventoryUpdate],
      commitInternal,
      reloadResource,
    });

    await expect(commands.updateItem('inventory-1', { name: 'Arabica coffee' })).resolves.toMatchObject({ name: 'Arabica coffee' });
    expect(updateInventoryItem).toHaveBeenCalledWith('inventory-1', { name: 'Arabica coffee' });
  });
});
