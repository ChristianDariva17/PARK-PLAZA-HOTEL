/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissions } from '../../../auth/authContext.js';
import { useHotel } from '../../../state/hotelContext.js';
import { CheckOutDialog } from './CheckInOutView.jsx';

vi.mock('../../../auth/authContext.js', () => ({ usePermissions: vi.fn() }));
vi.mock('../../../state/hotelContext.js', () => ({ useHotel: vi.fn() }));
vi.mock('../../../folios/FolioPanel', () => ({
  default: ({ onFolioChange, onStatusChange }) => <>
    <button type="button" onClick={() => { onFolioChange({ balance: '0.00' }); onStatusChange('success'); }}>Cargar folio liquidado</button>
    <button type="button" onClick={() => { onFolioChange({ balance: '0.00' }); onStatusChange('error'); }}>Marcar folio stale</button>
  </>,
}));

const stay = { id: 'stay-1', reservationId: 'reservation-1', roomId: 'room-1', checkInAt: '2028-02-28T15:00:00.000Z' };
const room = { id: 'room-1', number: '101', category: 'Doble' };

afterEach(cleanup);

describe('CheckOutDialog journey', () => {
  let stayCommands;

  beforeEach(() => {
    stayCommands = { checkOut: vi.fn(() => new Promise(() => {})) };
    vi.mocked(useHotel).mockReturnValue({
      state: { stayCommandRequest: { retryBlocked: false, error: '' } },
      stayCommands,
    });
    vi.mocked(usePermissions).mockReturnValue({ can: vi.fn(() => false) });
  });

  it('waits for the folio and sends only one checkout command', async () => {
    const user = userEvent.setup();
    render(<CheckOutDialog stay={stay} reservation={null} room={room} guest={{ name: 'Ada Lovelace' }} onClose={vi.fn()} notify={vi.fn()} />);

    const blockedSubmit = screen.getByRole('button', { name: 'Cargando saldo del folio…' });
    expect(blockedSubmit.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Cargar folio liquidado' }));
    const submit = screen.getByRole('button', { name: /Confirmar Check-out/ });
    await user.click(submit);
    await user.click(submit);

    expect(stayCommands.checkOut).toHaveBeenCalledOnce();
    expect(stayCommands.checkOut).toHaveBeenCalledWith('stay-1', {});
    expect(submit.disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Procesando check-out/ }).getAttribute('aria-busy')).toBe('true');
  });

  it('blocks checkout again when the loaded folio becomes stale', async () => {
    const user = userEvent.setup();
    render(<CheckOutDialog stay={stay} reservation={null} room={room} guest={{ name: 'Ada Lovelace' }} onClose={vi.fn()} notify={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cargar folio liquidado' }));
    await user.click(screen.getByRole('button', { name: 'Marcar folio stale' }));

    const submit = screen.getByRole('button', { name: 'Actualiza el folio para continuar' });
    expect(submit.disabled).toBe(true);
    expect(stayCommands.checkOut).not.toHaveBeenCalled();
  });
});
