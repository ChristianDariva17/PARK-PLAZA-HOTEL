export function validateReservationForm(form, { requireSelection = true } = {}) {
  const errors = {};
  const checkIn = form.checkInAt ? new Date(form.checkInAt) : null;
  const checkOut = form.checkOutAt ? new Date(form.checkOutAt) : null;
  const validCheckIn = checkIn && !Number.isNaN(checkIn.getTime());
  const validCheckOut = checkOut && !Number.isNaN(checkOut.getTime());

  if (!form.checkInAt) errors.checkInAt = 'Indique la fecha y hora de ingreso.';
  else if (!validCheckIn) errors.checkInAt = 'Ingrese una fecha de ingreso válida.';
  if (!form.checkOutAt) errors.checkOutAt = 'Indique la fecha y hora de salida.';
  else if (!validCheckOut) errors.checkOutAt = 'Ingrese una fecha de salida válida.';
  if (validCheckIn && validCheckOut && checkOut <= checkIn) errors.checkOutAt = 'La salida debe ser posterior al ingreso.';

  const guestCount = typeof form.guestCount === 'string' && /^[1-9]\d*$/.test(form.guestCount)
    ? Number(form.guestCount)
    : form.guestCount;
  if (!Number.isSafeInteger(guestCount) || guestCount <= 0) errors.guestCount = 'Ingrese una cantidad positiva de huéspedes.';

  if (requireSelection && !form.primaryGuestId) errors.primaryGuestId = 'Seleccione el huésped principal.';
  if (requireSelection && !form.roomId) errors.roomId = 'Consulte disponibilidad y seleccione una habitación.';

  return errors;
}
