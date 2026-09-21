/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey } from '../auth/authClient.js';
import { createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';
import FolioPanel from './FolioPanel.jsx';

vi.mock('../auth/authClient.js', () => ({ createIdempotencyKey: vi.fn() }));
vi.mock('./folioClient.js', () => ({
  createFolioCharge: vi.fn(),
  createFolioPayment: vi.fn(),
  getFolio: vi.fn(),
  reverseFolioEntry: vi.fn(),
}));

const folio = {
  balance: '25.00',
  entries: [],
  page: { offset: 0, limit: 50, total: 0 },
};

afterEach(cleanup);

describe('FolioPanel journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFolio).mockResolvedValue(folio);
    vi.mocked(createFolioPayment).mockImplementation(() => new Promise(() => {}));
    vi.mocked(createFolioCharge).mockResolvedValue({});
    vi.mocked(reverseFolioEntry).mockResolvedValue({});
    vi.mocked(createIdempotencyKey).mockReturnValue('folio-key-1');
  });

  it('shows a loading state while the folio is being fetched', () => {
    vi.mocked(getFolio).mockReturnValue(new Promise(() => {}));

    render(<FolioPanel stayId="stay-1" canPay canCharge canReverse />);

    expect(screen.getByRole('status').textContent).toContain('Cargando folio...');
  });

  it('sends one keyed payment request and locks the payment form', async () => {
    const user = userEvent.setup();
    render(<FolioPanel stayId="stay-1" canPay canCharge={false} canReverse={false} />);

    const submit = await screen.findByRole('button', { name: /Cobrar y Liquidar/ });
    await user.click(submit);
    await user.click(submit);

    expect(createFolioPayment).toHaveBeenCalledOnce();
    expect(createFolioPayment).toHaveBeenCalledWith('stay-1', { amount: '25.00', method: 'Efectivo' }, 'folio-key-1');
    expect(submit.disabled).toBe(true);
    expect(submit.closest('form').getAttribute('aria-busy')).toBe('true');
  });

  it('keeps the loaded folio visible and offers refresh after a load conflict', async () => {
    const user = userEvent.setup();
    vi.mocked(getFolio).mockResolvedValueOnce(folio).mockRejectedValueOnce(new Error('The folio changed. Refresh before retrying.'));
    render(<FolioPanel stayId="stay-1" canPay={false} canCharge={false} canReverse={false} />);

    await screen.findByText('Estado de Cuenta de la Habitación');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The folio changed. Refresh before retrying.');
    expect(alert.textContent).toContain('Actualizar folio');
    expect(screen.getByText('Estado de Cuenta de la Habitación')).toBeTruthy();
  });
});
