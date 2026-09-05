import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, apiRequest, cancelRestaurantOrder, createBooking, createRestaurantOrder, getAvailability } from './api.js';

test('API requests are relative and include the customer cookie', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ categories: [] }) };
  };
  await getAvailability({ checkInDate: '2028-02-28', checkOutDate: '2028-03-01', guestCount: 2 });
  assert.match(request.url, /^\/api\/customer\/reservations\/availability\?/);
  assert.equal(request.options.credentials, 'include');
  assert.match(request.url, /guestCount=2/);
  assert.match(request.url, /checkInDate=2028-02-28/);
});

test('booking requests carry civil dates and the caller idempotency key', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ reservation: { id: 'reservation-id' }, replayed: false }) };
  };
  const key = '550e8400-e29b-41d4-a716-446655440099';
  await createBooking({ checkInDate: '2028-02-28', checkOutDate: '2028-03-01' }, key);
  assert.equal(request.options.headers['Idempotency-Key'], key);
  assert.deepEqual(JSON.parse(request.options.body), { checkInDate: '2028-02-28', checkOutDate: '2028-03-01' });
});

test('failed requests reject instead of producing a success result', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ message: 'No room is available' }) });
  await assert.rejects(() => apiRequest('/customer/reservations', { method: 'POST', body: '{}' }), (error) => error instanceof ApiError && error.status === 409 && error.message === 'No room is available');
});

test('restaurant commands preserve caller idempotency keys and typed payloads', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, json: async () => ({}) }; };
  const key = '550e8400-e29b-41d4-a716-446655440099';
  await createRestaurantOrder({ stayId: key, deliveryMode: 'Room', paymentMode: 'room_charge', items: [], note: '' }, key);
  await cancelRestaurantOrder(key, 'changed_mind', key);
  assert.equal(requests[0].options.headers['Idempotency-Key'], key);
  assert.deepEqual(JSON.parse(requests[0].options.body).note, '');
  assert.deepEqual(JSON.parse(requests[1].options.body), { reasonCode: 'changed_mind' });
});
