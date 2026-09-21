/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../state/hotelContext', () => ({
  useHotel: vi.fn(),
  useHotelCommands: vi.fn(),
}));

import { useHotel, useHotelCommands } from '../../../state/hotelContext';
import { ReservationForm } from './ReservationsView';

const reservationRoom = {
  roomId: 'room-id',
  categoryId: 'category-id',
  number: '101',
  floor: 1,
  capacity: 2,
  operationalStatus: 'available',
  nightlyRate: '100.00',
  totalAmount: '200.00',
};

const commands = {
  availability: vi.fn(),
  clearAvailability: vi.fn(),
  create: vi.fn(() => new Promise(() => {})),
  refreshForRetry: vi.fn(),
};

beforeEach(() => {
  useHotelCommands.mockReturnValue({ guestCommands: { create: vi.fn() } });
  useHotel.mockReturnValue({
    state: {
      clients: [{ id: 'guest-id', status: 'Activo', name: 'Ada Lovelace', documentType: 'dni', documentNumber: '12345678' }],
      roomCategories: [{ id: 'category-id', name: 'Doble' }],
      reservationAvailability: { rooms: [reservationRoom] },
      reservationAvailabilityRequest: { status: 'success' },
      reservationCreateRequest: { status: 'idle', retryBlocked: false, error: '' },
    },
    reservationCommands: commands,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReservationForm journey', () => {
  it('keeps the entered form and sends only one create request on repeated submit', async () => {
    const user = userEvent.setup();
    render(<ReservationForm onClose={vi.fn()} notify={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Ingreso \(Check-in\)/), { target: { value: '2028-02-28T15:00' } });
    fireEvent.change(screen.getByLabelText(/Salida \(Check-out\)/), { target: { value: '2028-03-01T12:00' } });
    fireEvent.change(screen.getByLabelText(/Cantidad de Huéspedes/), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Huésped Principal/ }), { target: { value: 'guest-id' } });
    await user.click(screen.getByRole('button', { name: 'Seleccionar habitación 101' }));

    const submit = screen.getByRole('button', { name: /Registrar Reserva/ });
    await user.click(submit);
    await user.click(submit);

    expect(commands.create).toHaveBeenCalledOnce();
    expect(commands.create).toHaveBeenCalledWith({
      roomId: 'room-id',
      primaryGuestId: 'guest-id',
      checkInAt: new Date('2028-02-28T15:00').toISOString(),
      checkOutAt: new Date('2028-03-01T12:00').toISOString(),
      guestCount: '2',
    });
  });
});
