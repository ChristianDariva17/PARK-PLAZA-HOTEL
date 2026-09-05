import { AuthRequestError, authRequest } from '../auth/authClient.js';

export async function fetchAmenityReservations(signal) {
  try {
    const reservations = await authRequest('/api/amenities/reservations', { signal });
    if (!Array.isArray(reservations)) throw new Error('Invalid amenity reservations response');
    return reservations;
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 403) throw new Error('No cuenta con permiso para ver las reservas de zonas.');
    throw new Error('No se pudieron cargar las reservas de piscina y mirador.');
  }
}

export async function fetchAmenityConfigs(signal) {
  try {
    const configs = await authRequest('/api/amenities/config', { signal });
    return Array.isArray(configs) ? configs : [];
  } catch (error) {
    console.warn('Error al cargar configuración de amenidades:', error);
    return [];
  }
}

export async function updateAmenityConfig(payload) {
  try {
    const updated = await authRequest('/api/amenities/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return updated;
  } catch (error) {
    throw new Error(error.message || 'No se pudo actualizar la configuración de la zona.');
  }
}

export async function fetchAmenityOccupancy(signal) {
  try {
    const occupancy = await authRequest('/api/amenities/occupancy', { signal });
    return occupancy || {};
  } catch (error) {
    console.warn('Error al obtener aforo en tiempo real:', error);
    return {};
  }
}

export async function createManualAmenityPass(payload) {
  try {
    const result = await authRequest('/api/amenities/reservations/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result;
  } catch (error) {
    throw new Error(error.message || 'No se pudo registrar el pase de acceso.');
  }
}

export async function checkInAmenityPass(reservationId) {
  try {
    const result = await authRequest(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/checkin`, {
      method: 'POST',
    });
    return result;
  } catch (error) {
    throw new Error(error.message || 'No se pudo registrar el ingreso del visitante.');
  }
}

export async function fetchAmenityReservationTab(reservationId, signal) {
  try {
    const tab = await authRequest(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/tab`, { signal });
    return tab;
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 403) throw new Error('No cuenta con permiso para ver la cuenta de la reserva.');
    throw new Error('No se pudo cargar el detalle de la cuenta de consumos.');
  }
}

export async function updateAmenityReservationIdentity(reservationId, payload) {
  try {
    const updated = await authRequest(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/identity`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return updated;
  } catch (error) {
    throw new Error(error.message || 'No se pudo actualizar el DNI/titular de la reserva.');
  }
}

export async function settleAmenityReservation(reservationId, payload) {
  try {
    const result = await authRequest(`/api/amenities/reservations/${encodeURIComponent(reservationId)}/settle`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result;
  } catch (error) {
    throw new Error(error.message || 'No se pudo liquidar la cuenta de la reserva.');
  }
}

export async function fetchAmenityBlocks(signal) {
  try {
    const blocks = await authRequest('/api/amenities/blocks', { signal });
    return Array.isArray(blocks) ? blocks : [];
  } catch (error) {
    return [];
  }
}

export async function createAmenityBlock(payload) {
  try {
    const block = await authRequest('/api/amenities/blocks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return block;
  } catch (error) {
    throw new Error(error.message || 'No se pudo registrar el bloqueo de zona.');
  }
}
