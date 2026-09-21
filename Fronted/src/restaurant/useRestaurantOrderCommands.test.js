import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRestaurantOrderCommands } from './useRestaurantOrderCommands.js';
import { advanceOrder, cancelOrder, createOrder, updateOrder } from './restaurantClient.js';

vi.mock('./restaurantClient.js', () => ({
  advanceOrder: vi.fn(),
  advanceOrderItem: vi.fn(),
  cancelOrder: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
}));

const createdOrder = {
  id: 'order-1',
  source: 'Barra',
  status: 'Pedido recibido',
  total: '12.50',
  items: [],
};

describe('restaurant order commands', () => {
  const commitInternal = vi.fn();
  const reloadResource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    reloadResource.mockResolvedValue(null);
  });

  it('commits the adapted create response and refreshes orders', async () => {
    vi.mocked(createOrder).mockResolvedValue(createdOrder);
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    await expect(commands.createOrder({ source: 'Barra' }, 'idem-1')).resolves.toMatchObject({ id: 'order-1', total: 12.5 });

    expect(createOrder).toHaveBeenCalledWith({ source: 'Barra' }, 'idem-1');
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESTAURANT_ORDER_CREATED', order: expect.objectContaining({ id: 'order-1' }) }));
    expect(reloadResource).toHaveBeenCalledWith('orders');
  });

  it('generates an idempotency key when a caller omits one', async () => {
    vi.mocked(createOrder).mockResolvedValue(createdOrder);
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    await commands.createOrder({ source: 'Barra' });

    expect(createOrder).toHaveBeenCalledWith({ source: 'Barra' }, expect.stringMatching(/^[0-9a-f-]{36}$/i));
  });

  it('refreshes inventory after an order lifecycle command', async () => {
    vi.mocked(advanceOrder).mockResolvedValue({ ...createdOrder, status: 'Confirmado' });
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    await commands.advanceOrder('order-1', { expectedStatus: 'Pedido recibido' }, 'idem-2');

    expect(reloadResource).toHaveBeenCalledWith('orders');
    expect(reloadResource).toHaveBeenCalledWith('inventory');
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESTAURANT_ORDER_UPDATED' }));
  });

  it('refreshes orders even when a mutation fails', async () => {
    vi.mocked(updateOrder).mockRejectedValue(new Error('conflict'));
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    await expect(commands.updateOrder('order-1', {}, 'idem-3')).rejects.toThrow('conflict');

    expect(reloadResource).toHaveBeenCalledWith('orders');
    expect(commitInternal).not.toHaveBeenCalled();
  });

  it('keeps legacy command aliases while exposing the short command names', () => {
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    expect(commands.createOrderCommand).toBe(commands.createOrder);
    expect(commands.updateOrderCommand).toBe(commands.updateOrder);
    expect(commands.advanceOrderCommand).toBe(commands.advanceOrder);
    expect(commands.cancelOrderCommand).toBe(commands.cancelOrder);
  });

  it('uses the order client for cancellation', async () => {
    vi.mocked(cancelOrder).mockResolvedValue({ ...createdOrder, status: 'Cancelado' });
    const commands = createRestaurantOrderCommands({ commitInternal, reloadResource });

    await commands.cancelOrder('order-1', { reason: 'test' }, 'idem-4');

    expect(cancelOrder).toHaveBeenCalledWith('order-1', { reason: 'test' }, 'idem-4');
  });
});
