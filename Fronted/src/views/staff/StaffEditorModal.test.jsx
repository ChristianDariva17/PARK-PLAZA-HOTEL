/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStaff: vi.fn(),
  getStaffProfile: vi.fn(),
  updateStaff: vi.fn(),
}));

vi.mock('../../staff/staffClient.js', () => ({ staffClient: mocks }));

import { StaffEditorModal } from './StaffEditorModal.jsx';

let appRoot;

beforeEach(() => {
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  vi.clearAllMocks();
  mocks.createStaff.mockResolvedValue({ id: 'staff-1' });
  mocks.updateStaff.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  appRoot?.remove();
  appRoot = null;
});

describe('StaffEditorModal', () => {
  it('creates a staff profile with the required identity fields', async () => {
    const onSaved = vi.fn();

    render(<StaffEditorModal onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByPlaceholderText('Ej. Valeria Sofía'), { target: { value: 'Valeria' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Mendoza Castro'), { target: { value: 'Mendoza' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 70889901'), { target: { value: '70889901' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Recepcionista Principal'), {
      target: { value: 'Recepcionista' },
    });
    fireEvent.change(screen.getByPlaceholderText('colaborador@hotelparkplaza.com'), {
      target: { value: 'valeria@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Colaborador' }));

    await waitFor(() =>
      expect(mocks.createStaff).toHaveBeenCalledWith({
        firstName: 'Valeria',
        lastName: 'Mendoza',
        documentNormalized: '70889901',
        position: 'Recepcionista',
        department: '',
        phone: '',
        email: 'valeria@example.test',
      }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('loads an existing profile and submits edited values to the update contract', async () => {
    const profile = {
      firstName: 'Valeria',
      lastName: 'Mendoza',
      documentNormalized: '70889901',
      position: 'Recepcionista',
      department: 'Recepción y Reservas',
      phone: '+51 987 654 321',
      email: 'valeria@example.test',
    };
    mocks.getStaffProfile.mockResolvedValue(profile);

    render(<StaffEditorModal staffId="staff-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByDisplayValue('Valeria')).toBeTruthy());
    const position = screen.getByDisplayValue('Recepcionista');
    fireEvent.change(position, { target: { value: 'Jefa de Recepción' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() =>
      expect(mocks.updateStaff).toHaveBeenCalledWith('staff-1', {
        ...profile,
        position: 'Jefa de Recepción',
      }),
    );
  });
});
