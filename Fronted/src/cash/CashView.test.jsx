/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotel } from '../state/hotelContext.js';
import { CashOpenForm } from './CashView.jsx';

vi.mock('../state/hotelContext.js', () => ({ useHotel: vi.fn(), useHotelCommands: vi.fn() }));
vi.mock('../components/auth/useActionPermission.js', () => ({ useActionPermission: vi.fn(() => true) }));

afterEach(cleanup);

describe('CashOpenForm journey', () => {
  let cashCommands;

  beforeEach(() => {
    cashCommands = { open: vi.fn(() => new Promise(() => {})) };
    vi.mocked(useHotel).mockReturnValue({ state: { staff: [] }, cashCommands });
  });

  it('sends one request and locks the form while opening a shift', async () => {
    const user = userEvent.setup();
    render(<CashOpenForm onClose={vi.fn()} notify={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Nombre del encargado o cajero...'), 'Ana');
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '100');
    const submit = screen.getByRole('button', { name: 'Abrir caja' });

    await user.click(submit);
    await user.click(submit);

    expect(cashCommands.open).toHaveBeenCalledOnce();
    expect(cashCommands.open).toHaveBeenCalledWith({ openingAmount: '100', responsible: 'Ana', shift: 'Mañana', notes: '' });
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
  });
});
