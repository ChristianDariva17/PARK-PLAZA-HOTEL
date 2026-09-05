export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const method = options.method?.toUpperCase() || 'GET';
  const isMutation = ['POST', 'PUT', 'PATCH'].includes(method);
  
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutation && !options.headers?.['Idempotency-Key'] ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    ...options.headers,
  };

  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'The request could not be completed.';
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

export const exchangeFirebaseToken = (idToken) => apiRequest('/customer/auth/session', { method: 'POST', body: JSON.stringify({ idToken }) });
export const getCustomerSession = () => apiRequest('/customer/auth/session');
export const endCustomerSession = () => apiRequest('/customer/auth/logout', { method: 'POST' });

export function getAvailability({ checkInDate, checkOutDate, guestCount }) {
  const query = new URLSearchParams({ checkInDate, checkOutDate, guestCount: String(guestCount) });
  return apiRequest(`/customer/reservations/availability?${query}`);
}

export const getCustomerRoomAmenities = () => apiRequest('/customer/reservations/amenities');

export const createBooking = (booking, idempotencyKey) => apiRequest('/customer/reservations', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(booking),
});
export const getBooking = (reservationId) => apiRequest(`/customer/reservations/${encodeURIComponent(reservationId)}`);

export const getRestaurantMenu = () => apiRequest('/customer/restaurant/menu');
export const getRestaurantOrders = () => apiRequest('/customer/restaurant/orders');
export const getCustomerRestaurantActiveStays = () => apiRequest('/customer/restaurant/active-stays');
export const createRestaurantOrder = (orderPayload, idempotencyKey) => apiRequest('/customer/restaurant/orders', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(orderPayload),
});

export const cancelRestaurantOrder = (orderId, reasonCode, idempotencyKey) => apiRequest(`/customer/restaurant/orders/${encodeURIComponent(orderId)}/cancel`, {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify({ reasonCode }),
});

export const getAmenitiesReservations = () => apiRequest('/customer/amenities/reservations');
export const getAmenityConfigs = () => apiRequest('/customer/amenities/config');
export const createAmenityReservation = (payload, idempotencyKey) => apiRequest('/customer/amenities/reservations', {
  method: 'POST',
  headers: { ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
  body: JSON.stringify(payload),
});

export const getEventSpaces = () => apiRequest('/customer/events/spaces');
export const getEventSpacePolicy = (spaceId) => apiRequest(`/customer/events/spaces/${encodeURIComponent(spaceId)}`);
export const quoteEvent = (payload) => apiRequest('/customer/events/quote', { method: 'POST', body: JSON.stringify(payload) });
export const createEventPreReservation = (payload, idempotencyKey) => apiRequest('/customer/events', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(payload),
});
export const getCustomerEvents = () => apiRequest('/customer/events');
export const cancelCustomerEvent = (eventId, reason, idempotencyKey) => apiRequest(`/customer/events/${encodeURIComponent(eventId)}/cancel`, {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify({ reason }),
});
