import { describe, expect, it } from 'vitest';
import { validateReservationForm } from './reservationFormModel.js';

const validForm = {
  checkInAt: '2028-02-28T15:00',
  checkOutAt: '2028-03-01T12:00',
  guestCount: '2',
  primaryGuestId: 'guest-id',
  roomId: 'room-id',
};

describe('reservation form validation', () => {
  it('accepts a complete reservation and supports availability-only validation', () => {
    expect(validateReservationForm(validForm)).toEqual({});
    expect(validateReservationForm({ ...validForm, primaryGuestId: '', roomId: '' }, { requireSelection: false })).toEqual({});
  });

  it('reports field-level errors without discarding entered values', () => {
    expect(validateReservationForm({ ...validForm, checkOutAt: '2028-02-28T14:00', guestCount: '0', primaryGuestId: '', roomId: '' })).toEqual({
      checkOutAt: 'La salida debe ser posterior al ingreso.',
      guestCount: 'Ingrese una cantidad positiva de huéspedes.',
      primaryGuestId: 'Seleccione el huésped principal.',
      roomId: 'Consulte disponibilidad y seleccione una habitación.',
    });
  });

  it('requires both interval boundaries', () => {
    expect(validateReservationForm({ ...validForm, checkInAt: '', checkOutAt: '' }, { requireSelection: false })).toMatchObject({
      checkInAt: 'Indique la fecha y hora de ingreso.',
      checkOutAt: 'Indique la fecha y hora de salida.',
    });
  });
});
