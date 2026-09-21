import { useEffect, useMemo } from 'react';
import { subscribeToEvent } from '../realtime/socketClient.js';
import { createResourceSnapshot } from '../api/resourceState.js';

/**
 * Retorna el estado, los datos y una función de reintento para un recurso de restaurante específico.
 * @param {object} state - El estado global proveniente de useHotel()
 * @param {object} commands - El objeto restaurantCommands proveniente de useHotel()
 * @param {string} resourceKey - La clave del recurso ('menu', 'orders', 'inventory', 'inventoryLedger')
 */
export function useRestaurantResource(state, commands, resourceKey) {
  const meta = state.restaurantResources?.[resourceKey];
  
  let data = [];
  if (resourceKey === 'menu') data = state.recipes || [];
  else if (resourceKey === 'orders') data = state.orders || [];
  else if (resourceKey === 'inventory') data = state.inventory || [];
  else if (resourceKey === 'inventoryLedger') data = state.inventoryLedger || [];

  const reload = useMemo(() => {
    return () => commands.reloadResource?.(resourceKey);
  }, [commands, resourceKey]);

  useEffect(() => {
    if (!commands.reloadResource) return;

    const reloadOrders = () => {
      const result = commands.reloadResource('orders');
      if (result && typeof result.catch === 'function') result.catch(() => {});
    };

    if (resourceKey === 'orders') {
      const unsub1 = subscribeToEvent('order:created', reloadOrders);
      const unsub2 = subscribeToEvent('order:status_changed', reloadOrders);
      const unsub3 = subscribeToEvent('order:cancelled', reloadOrders);
      const unsub4 = subscribeToEvent('order:updated', reloadOrders);

      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
      };
    }
  }, [commands, resourceKey]);

  return {
    ...createResourceSnapshot({
      status: meta?.status,
      data,
      error: meta?.error,
      errorDetails: meta?.errorDetails,
      updatedAt: meta?.updatedAt,
      permission: meta?.permission,
    }),
    reload,
  };
}
