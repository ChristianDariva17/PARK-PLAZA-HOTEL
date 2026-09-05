import { useEffect, useMemo } from 'react';
import { subscribeToEvent } from '../realtime/socketClient.js';

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

    if (resourceKey === 'orders') {
      const unsub1 = subscribeToEvent('order:created', () => {
        console.log('[WebSocket] Nuevo pedido en tiempo real recibido');
        commands.reloadResource('orders');
      });
      const unsub2 = subscribeToEvent('order:status_changed', () => {
        commands.reloadResource('orders');
      });
      const unsub3 = subscribeToEvent('order:cancelled', () => {
        commands.reloadResource('orders');
      });
      const unsub4 = subscribeToEvent('order:updated', () => {
        commands.reloadResource('orders');
      });

      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
      };
    }
  }, [commands, resourceKey]);

  return {
    status: meta?.status || 'idle',
    permission: meta?.permission,
    error: meta?.error,
    updatedAt: meta?.updatedAt,
    isForbidden: meta?.status === 'forbidden',
    isUnavailable: meta?.status === 'unavailable',
    isLoading: meta?.status === 'loading',
    isError: meta?.status === 'error',
    isSuccess: meta?.status === 'success',
    isIdle: !meta || meta.status === 'idle',
    data,
    reload,
  };
}
