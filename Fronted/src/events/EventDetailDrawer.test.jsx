/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  advanceEvent: vi.fn(),
  archiveEvent: vi.fn(),
  cancelEvent: vi.fn(),
  confirmEvent: vi.fn(),
  getEventDetail: vi.fn(),
}));

vi.mock('./eventsClient', () => ({ eventsClient: mocks }));
vi.mock('./EventBeoModal', () => ({ EventBeoModal: () => null }));

import { EventDetailDrawer } from './EventDetailDrawer.jsx';

const baseEvent = {
  id: 'event-12345678',
  title: 'Board meeting',
  description: 'Quarterly leadership meeting',
  status: 'draft',
  quarantineStatus: 'resolved',
  version: 3,
  guestId: 'guest-1',
  guest: { firstName: 'Ana', lastName: 'Pérez' },
  space: { name: 'Salón A' },
  attendees: 20,
  startsAt: '2026-09-18T18:00:00.000Z',
  endsAt: '2026-09-18T22:00:00.000Z',
  estimatedAmount: '1500.00',
  depositAmount: '300.00',
  services: [],
};

let appRoot;

beforeEach(() => {
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  vi.clearAllMocks();
  mocks.getEventDetail.mockResolvedValue(baseEvent);
});

afterEach(() => {
  cleanup();
  appRoot?.remove();
  appRoot = null;
});

describe('EventDetailDrawer', () => {
  it('confirms a draft event with the current version and payment details', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(<EventDetailDrawer eventId={baseEvent.id} onClose={vi.fn()} onEdit={vi.fn()} onRefresh={onRefresh} />);

    await waitFor(() => expect(screen.getByText('Board meeting')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /Confirmar & Cobrar Adelanto/ }));

    const amount = screen.getByRole('spinbutton');
    await user.clear(amount);
    await user.type(amount, '350');
    await user.selectOptions(screen.getByRole('combobox'), 'Transferencia Bancaria');
    await user.type(screen.getByPlaceholderText('Ej: Transf. BCP Op. #982341'), 'Op. 982341');
    await user.click(screen.getByRole('button', { name: 'Confirmar & Bloquear Salón' }));

    await waitFor(() =>
      expect(mocks.confirmEvent).toHaveBeenCalledWith(
        baseEvent.id,
        baseEvent.version,
        350,
        'Transferencia Bancaria',
        'Op. 982341',
      ),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('does not expose edit or confirm actions while identity is quarantined', async () => {
    const user = userEvent.setup();
    mocks.getEventDetail.mockResolvedValue({ ...baseEvent, quarantineStatus: 'pending' });

    render(<EventDetailDrawer eventId={baseEvent.id} onClose={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Identidad en Cuarentena')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Modificar Datos del Evento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Confirmar & Cobrar Adelanto/ })).toBeNull();
    expect(screen.getByText(/Debe resolver la identidad/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cerrar Detalle del Salón & Banquetería' }));
  });
});
