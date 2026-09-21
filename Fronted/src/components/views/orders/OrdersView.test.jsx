/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderFormModal } from './OrdersView';

const recipe = {
  id: 'menu-1',
  name: 'Sandwich ejecutivo',
  category: 'Comidas',
  salePrice: 12,
  status: 'active',
  ingredients: [],
};

afterEach(cleanup);

describe('OrderFormModal journey', () => {
  function renderForm(overrides = {}) {
    const restaurantCommands = {
      createOrder: vi.fn(() => new Promise(() => {})),
      updateOrder: vi.fn(() => new Promise(() => {})),
    };
    render(
      <OrderFormModal
        stays={[]}
        recipes={[recipe]}
        inventory={[]}
        onClose={vi.fn()}
        restaurantCommands={restaurantCommands}
        notify={vi.fn()}
        {...overrides}
      />,
    );
    return restaurantCommands;
  }

  it('rejects an empty cart with an actionable form error', async () => {
    const user = userEvent.setup();
    const commands = renderForm();

    await user.click(screen.getByRole('button', { name: 'Enviar Comanda' }));

    expect(screen.getByText('Revise los campos marcados antes de enviar el pedido.')).toBeTruthy();
    expect(screen.getByText('Seleccione un producto.')).toBeTruthy();
    expect(commands.createOrder).not.toHaveBeenCalled();
  });

  it('sends one keyed request when the operator submits the selected cart twice', async () => {
    const user = userEvent.setup();
    const commands = renderForm();

    await user.click(screen.getByRole('button', { name: 'Producto 1' }));
    await user.click(screen.getByRole('option', { name: /Sandwich ejecutivo/ }));
    const submit = screen.getByRole('button', { name: 'Enviar Comanda' });
    await user.click(submit);
    await user.click(submit);

    expect(commands.createOrder).toHaveBeenCalledOnce();
    expect(commands.createOrder).toHaveBeenCalledWith({
      source: 'Barra',
      stayId: null,
      items: [{ menuItemId: 'menu-1', quantity: 1, notes: null }],
      paymentMethod: 'Efectivo',
      estimatedMinutes: 15,
      comment: null,
    }, expect.stringMatching(/^[0-9a-f-]{36}$/i));
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
  });
});
