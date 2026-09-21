/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotelCommands } from '../state/hotelContext.js';
import { CashMovementEnhancedForm } from './CashMovementEnhancedForm.jsx';

vi.mock('../state/hotelContext.js', () => ({ useHotel: vi.fn(), useHotelCommands: vi.fn() }));
vi.mock('../components/auth/useActionPermission.js', () => ({ useActionPermission: vi.fn(() => true) }));

afterEach(cleanup);

describe('CashMovementEnhancedForm journey', () => {
  let cashCommands;
  let resolveMovement;

  beforeEach(() => {
    resolveMovement = null;
    cashCommands = {
      move: vi.fn(() => new Promise((resolve) => {
        resolveMovement = resolve;
      })),
    };
    vi.mocked(useHotelCommands).mockReturnValue({ cashCommands });
  });

  it('rejects a high expense when the beneficiary is missing even with a concept', () => {
    const notify = vi.fn();
    render(<CashMovementEnhancedForm onClose={vi.fn()} notify={notify} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '200' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Concepto/ }), { target: { value: 'Compra urgente' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Movimiento de caja' }));

    expect(notify).toHaveBeenCalledWith('Justificación requerida', expect.any(String), 'error');
    expect(cashCommands.move).not.toHaveBeenCalled();
  });

  it('sends one movement request and locks the form while saving', async () => {
    const onClose = vi.fn();
    render(<CashMovementEnhancedForm onClose={onClose} notify={vi.fn()} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Concepto/ }), { target: { value: 'Cambio de sencillo' } });
    const submit = screen.getByRole('button', { name: 'Registrar Egreso' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(cashCommands.move).toHaveBeenCalledOnce();
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');

    resolveMovement({ id: 'movement-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
