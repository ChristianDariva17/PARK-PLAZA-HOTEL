import { useMemo } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptInventoryList } from './restaurantModel.js';
import { adjustInventory, archiveInventoryItem, createInventoryItem, reactivateInventoryItem, updateInventoryItem } from './restaurantClient.js';

export function createRestaurantInventoryCommands({ permissions = [], commitInternal, reloadResource }) {
  const createItem = async (body) => {
    if (!permissions.includes(PERMISSIONS.inventoryCreate)) throw new Error('Sin permiso para crear insumos.');
    const response = await createInventoryItem(body);
    const item = adaptInventoryList([response])[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_CREATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('menu')]);
    return item;
  };

  const updateItem = async (id, body) => {
    if (!permissions.includes(PERMISSIONS.inventoryUpdate)) throw new Error('Sin permiso para editar insumos.');
    const response = await updateInventoryItem(id, body);
    const item = adaptInventoryList([response])[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('menu')]);
    return item;
  };

  const archiveItem = async (id, body) => {
    if (!permissions.includes(PERMISSIONS.inventoryArchive)) throw new Error('Sin permiso para archivar insumos.');
    const response = await archiveInventoryItem(id, body);
    const item = adaptInventoryList([response])[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  };

  const reactivateItem = async (id) => {
    if (!permissions.includes(PERMISSIONS.inventoryArchive)) throw new Error('Sin permiso para reactivar insumos.');
    const response = await reactivateInventoryItem(id);
    const item = adaptInventoryList([response])[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  };

  const adjustStock = async (id, body) => {
    if (!permissions.includes(PERMISSIONS.inventoryAdjust)) throw new Error('Sin permiso para ajustar inventario.');
    const response = await adjustInventory(id, body);
    const item = adaptInventoryList([response])[0];
    commitInternal({ type: 'RESTAURANT_INVENTORY_ITEM_UPDATED', item });
    Promise.allSettled([reloadResource('inventory'), reloadResource('inventoryLedger'), reloadResource('menu')]);
    return item;
  };

  return {
    reloadInventory: () => reloadResource('inventory'),
    reloadLedger: () => reloadResource('inventoryLedger'),
    createItem,
    updateItem,
    archiveItem,
    reactivateItem,
    adjustStock,
  };
}

export function useRestaurantInventoryCommands({ permissions = [], commitInternal, reloadResource }) {
  return useMemo(
    () => createRestaurantInventoryCommands({ permissions, commitInternal, reloadResource }),
    [commitInternal, permissions, reloadResource],
  );
}
