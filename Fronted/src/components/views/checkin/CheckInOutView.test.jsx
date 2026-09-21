/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../state/hotelContext', () => ({ useHotel: vi.fn() }));
vi.mock('../../common/SignatureCanvas.jsx', () => ({
  SignatureCanvas: ({ onChange }) => <button type="button" onClick={() => onChange('data:image/png;base64,signature')}>Capturar firma</button>,
}));
vi.mock('../../../documents/StayConditionsDocument.jsx', () => ({
  StayConditionsDocument: () => <div>Documento de condiciones</div>,
}));
vi.mock('../../../documents/documentsClient.js', () => ({
  documentsClient: { createContract: vi.fn() },
}));

import { useHotel } from '../../../state/hotelContext';
import { documentsClient } from '../../../documents/documentsClient.js';
import { CheckInDialog } from './CheckInOutView';

const reservation = {
  id: 'reservation-id',
  status: 'pending',
  checkInAt: '2028-02-28T15:00:00.000Z',
  checkOutAt: '2028-03-01T12:00:00.000Z',
  nightlyRate: '100.00',
  total: '200.00',
};
const guest = { name: 'Ada Lovelace', documentNumber: '12345678', docType: 'DNI' };
const room = { id: 'room-id', number: '101', category: 'Doble' };

let stayCommands;

beforeEach(() => {
  stayCommands = { checkIn: vi.fn(() => new Promise(() => {})) };
  useHotel.mockReturnValue({
    state: { account: { name: 'Recepción' }, stayCommandRequest: { retryBlocked: false, error: '' } },
    stayCommands,
  });
  documentsClient.createContract.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CheckInDialog journey', () => {
  async function prepareSignature() {
    const user = userEvent.setup();
    render(<CheckInDialog reservation={reservation} guest={guest} room={room} onClose={vi.fn()} notify={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Documento y Firma Digital/ }));
    await user.click(screen.getByRole('button', { name: 'Capturar firma' }));
    return user;
  }

  it('persists the signed document and sends only one check-in command', async () => {
    const user = await prepareSignature();
    const confirm = screen.getByRole('button', { name: /Confirmar Check-in/ });

    await user.click(confirm);
    await user.click(confirm);

    expect(documentsClient.createContract).toHaveBeenCalledOnce();
    expect(stayCommands.checkIn).toHaveBeenCalledOnce();
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
  });

  it('does not open the stay when the signed document cannot be saved', async () => {
    documentsClient.createContract.mockRejectedValueOnce(new Error('transport detail'));
    const user = await prepareSignature();

    await user.click(screen.getByRole('button', { name: /Confirmar Check-in/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar el documento firmado.');
    expect(stayCommands.checkIn).not.toHaveBeenCalled();
  });
});
