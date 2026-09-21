import { useMemo } from 'react';
import { createIdempotencyKey } from '../auth/authClient.js';
import { adaptOrdersList } from './restaurantModel.js';
import { advanceOrder, advanceOrderItem, cancelOrder, createOrder, updateOrder } from './restaurantClient.js';

export function createRestaurantOrderCommands({ commitInternal, reloadResource }) {
  const createOrderCommand = async (body, idempotencyKey = createIdempotencyKey()) => {
    try {
      const response = await createOrder(body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_CREATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
    }
  };

  const updateOrderCommand = async (orderId, body, idempotencyKey = createIdempotencyKey()) => {
    try {
      const response = await updateOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
    }
  };

  const advanceOrderCommand = async (orderId, body, idempotencyKey = createIdempotencyKey()) => {
    try {
      const response = await advanceOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  };

  const advanceOrderItemCommand = async (orderId, itemId, body, idempotencyKey = createIdempotencyKey()) => {
    try {
      const response = await advanceOrderItem(orderId, itemId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  };

  const cancelOrderCommand = async (orderId, body, idempotencyKey = createIdempotencyKey()) => {
    try {
      const response = await cancelOrder(orderId, body, idempotencyKey);
      const adapted = adaptOrdersList([response]);
      commitInternal({ type: 'RESTAURANT_ORDER_UPDATED', order: adapted[0] });
      return adapted[0];
    } finally {
      reloadResource('orders');
      reloadResource('inventory');
    }
  };

  return {
    createOrder: createOrderCommand,
    updateOrder: updateOrderCommand,
    advanceOrder: advanceOrderCommand,
    advanceOrderItem: advanceOrderItemCommand,
    cancelOrder: cancelOrderCommand,
    createOrderCommand,
    updateOrderCommand,
    advanceOrderCommand,
    advanceOrderItemCommand,
    cancelOrderCommand,
  };
}

export function useRestaurantOrderCommands({ commitInternal, reloadResource }) {
  return useMemo(() => createRestaurantOrderCommands({ commitInternal, reloadResource }), [commitInternal, reloadResource]);
}
