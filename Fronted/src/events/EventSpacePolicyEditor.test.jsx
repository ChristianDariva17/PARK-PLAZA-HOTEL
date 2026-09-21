/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSpaces: vi.fn(),
  getSpacePolicy: vi.fn(),
  updateSpacePolicy: vi.fn(),
  replaceSpaceServices: vi.fn(),
}));

vi.mock('./eventsClient', () => ({ eventsClient: mocks }));

import { EventSpacePolicyEditor } from './EventSpacePolicyEditor.jsx';

const space = { id: 'space-1', name: 'Salón A' };

const policy = {
  id: 'space-1',
  capacity: 120,
  setupMinutes: 45,
  teardownMinutes: 20,
  minimumDurationMinutes: 60,
  baseRate: '500.00',
  includedMinutes: 60,
  extraMinuteRate: '10.00',
  depositPercentage: '30.00',
  guaranteeAmount: '1000.00',
  cleaningFee: '150.00',
  taxRate: '18.00',
  openingTime: '08:00',
  closingTime: '22:00',
  rules: {
    liveMusicAllowed: false,
    externalCateringAllowed: true,
    securityRequired: true,
    smokingAllowed: false,
    maxDecibels: 90,
    customRules: ['No confeti metálico'],
  },
  cancellationPolicy: {
    daysBeforeFullRefund: 30,
    penaltyPercentage: 75,
    guaranteeRefundable: false,
    notes: 'Avisar con 30 días de anticipación.',
  },
  services: [
    {
      code: 'projector',
      name: 'Proyector',
      category: 'Audio & Proyección',
      unitAmount: '100.00',
      perPerson: false,
      active: true,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSpaces.mockResolvedValue([space]);
  mocks.getSpacePolicy.mockResolvedValue(policy);
  mocks.updateSpacePolicy.mockResolvedValue(policy);
  mocks.replaceSpaceServices.mockResolvedValue({ ...policy, services: policy.services });
});

afterEach(cleanup);

describe('EventSpacePolicyEditor', () => {
  it('loads, edits, and saves a space policy with normalized values and services', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<EventSpacePolicyEditor onSaved={onSaved} onClose={onClose} />);

    await waitFor(() => expect(mocks.getSpacePolicy).toHaveBeenCalledWith('space-1', expect.any(AbortSignal)));
    expect(screen.getByDisplayValue('Salón A')).toBeTruthy();
    expect(screen.getByText('No confeti metálico')).toBeTruthy();
    expect(screen.getByText('Proyector')).toBeTruthy();

    fireEvent.click(screen.getByText('Catering Externo Permitido').closest('label'));
    fireEvent.change(document.querySelector('.event-policy-volume-grid input'), {
      target: { value: '95' },
    });

    fireEvent.change(
      screen.getByPlaceholderText('Ej: No se permite pirotecnia en interiores, Prohibido confeti metálico...'),
      {
        target: { value: 'Sin velas en interiores' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /Agregar Regla/ }));

    fireEvent.click(screen.getByRole('button', { name: /Agregar Servicio/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej: Open Bar Autor, Coffee Break...'), {
      target: { value: 'Coffee Break' },
    });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: 'fixed' } });
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '125.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Coffee Break')).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('Eliminar servicio')[0]);
    expect(screen.queryByText('Proyector')).toBeNull();

    fireEvent.submit(document.querySelector('form.event-policy-form'));

    await waitFor(() => expect(mocks.updateSpacePolicy).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.replaceSpaceServices).toHaveBeenCalledOnce());

    const [spaceId, payload] = mocks.updateSpacePolicy.mock.calls[0];
    expect(spaceId).toBe('space-1');
    expect(payload).toMatchObject({
      capacity: 120,
      baseRate: 500,
      openingTime: '08:00',
      closingTime: '22:00',
      rules: {
        liveMusicAllowed: false,
        externalCateringAllowed: false,
        maxDecibels: 95,
        customRules: ['No confeti metálico', 'Sin velas en interiores'],
      },
      cancellationPolicy: policy.cancellationPolicy,
    });

    expect(mocks.replaceSpaceServices).toHaveBeenCalledWith('space-1', [
      {
        code: 'coffee_break',
        name: 'Coffee Break',
        category: 'Gastronomía & Catering',
        unitAmount: 125.5,
        perPerson: false,
      },
    ]);
    expect(screen.getByText('¡Políticas y catálogo de servicios guardados con éxito!')).toBeTruthy();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
