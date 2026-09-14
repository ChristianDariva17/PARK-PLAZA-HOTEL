import { expect, test } from '@playwright/test';

test('opens the customer portal with a valid session', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTitle('Cerrar Sesión')).toBeVisible();
  await expect(page.getByText('Miembro')).toBeVisible();
});

test('loads the authenticated room service surface', async ({ page }) => {
  await page.goto('/room-service');

  await expect(page.getByRole('heading', { name: 'Gastronomía de Autor' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Nuestra Carta' })).toBeVisible();
});

test('loads the authenticated amenity surface', async ({ page }) => {
  await page.goto('/piscina');

  await expect(page.getByText('PISCINA', { exact: true })).toBeVisible();
});

const requestJson = async (page, path, options = {}) => {
  const result = await page.evaluate(async ({ path: requestPath, method, data, headers }) => {
    const response = await fetch(requestPath, {
      method,
      credentials: 'include',
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, {
    path,
    method: options.method || 'GET',
    data: options.data,
    headers: {
      ...(options.data ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  expect(result.ok, `${options.method || 'GET'} ${path} (${result.status}): ${result.text}`).toBeTruthy();
  return result.text ? JSON.parse(result.text) : null;
};

test('covers authenticated customer mutation lifecycles and idempotency', async ({ page }) => {
  test.skip(process.env.CUSTOMER_E2E_MUTATIONS !== 'true', 'Mutation E2E requires an isolated database.');

  await page.goto('/');
  const session = await requestJson(page, '/api/customer/auth/session');
  expect(session.customer.email).toBeTruthy();

  const reservationKey = crypto.randomUUID();
  const availability = await requestJson(page, '/api/customer/reservations/availability?checkInDate=2035-01-15&checkOutDate=2035-01-16&guestCount=1');
  const category = availability.categories?.[0];
  expect(category?.code).toBeTruthy();
  const reservationPayload = {
    categoryCode: category.code,
    checkInDate: '2035-01-15',
    checkOutDate: '2035-01-16',
    guestCount: 1,
    guest: {
      firstName: 'E2E',
      lastName: `Customer ${reservationKey.slice(0, 8)}`,
      email: session.customer.email,
      primaryDocument: { type: 'other', issuingCountry: 'PE', documentNumber: `E2E-${reservationKey.slice(0, 12)}` },
    },
  };
  const reservationResponse = await requestJson(page, '/api/customer/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': reservationKey },
    data: reservationPayload,
  });
  const reservationReplay = await requestJson(page, '/api/customer/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': reservationKey },
    data: reservationPayload,
  });
  expect(reservationReplay.reservation.id).toBe(reservationResponse.reservation.id);
  const reservationDetail = await requestJson(page, `/api/customer/reservations/${reservationResponse.reservation.id}`);
  expect(reservationDetail.id).toBe(reservationResponse.reservation.id);

  const spaces = await requestJson(page, '/api/customer/events/spaces');
  expect(spaces.length).toBeGreaterThan(0);
  const space = spaces[0];
  const eventPayload = {
    title: `E2E event ${reservationKey.slice(0, 8)}`,
    description: 'Temporary authenticated E2E event.',
    spaceId: space.id,
    attendees: 1,
    timezone: 'America/Lima',
    services: [],
    eventStartsAt: '2035-02-15T16:00:00.000Z',
    eventEndsAt: '2035-02-15T17:00:00.000Z',
  };
  const eventResponse = await requestJson(page, '/api/customer/events', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: eventPayload,
  });
  expect(eventResponse.status).toBe('tentative');
  const cancelledEvent = await requestJson(page, `/api/customer/events/${eventResponse.id}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { reason: 'E2E cleanup' },
  });
  expect(cancelledEvent.status).toBe('cancelled');

  const configs = await requestJson(page, '/api/customer/amenities/config');
  const amenity = configs.find((config) => config.isActive);
  expect(amenity?.name).toBeTruthy();
  const amenityResponse = await requestJson(page, '/api/customer/amenities/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      amenityType: amenity.amenityKey,
      startTime: '2035-03-15T16:00:00.000Z',
      endTime: '2035-03-15T18:00:00.000Z',
      pax: 1,
      documentNumber: `E2E-${reservationKey.slice(0, 12)}`,
      customerName: 'E2E Customer',
    },
  });
  expect(amenityResponse.status).toBe('confirmed');

  const menu = await requestJson(page, '/api/customer/restaurant/menu');
  const menuItem = menu.find((item) => item.stockAvailable !== false && (Number(item.salePrice) > 0 || Number(item.variants?.[0]?.price) > 0));
  expect(menuItem?.id).toBeTruthy();
  const orderResponse = await requestJson(page, '/api/customer/restaurant/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      stayId: null,
      amenityReservationId: amenityResponse.id,
      deliveryMode: amenity.amenityKey === 'piscina' ? 'Piscina' : 'Mirador',
      paymentMode: 'amenity_tab',
      items: [{ menuItemId: menuItem.id, variantId: menuItem.variants?.[0]?.id ?? null, quantity: 1 }],
      note: 'E2E cleanup order',
    },
  });
  expect(orderResponse.order?.id).toBeTruthy();
  const cancelledOrder = await requestJson(page, `/api/customer/restaurant/orders/${orderResponse.order.id}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { reasonCode: 'changed_mind' },
  });
  expect(cancelledOrder.order.status).toBe('Cancelado');
});
