import { randomUUID } from 'node:crypto';
import { expect, test } from './authenticated-fixtures.js';

test('opens the administrative dashboard with a valid session', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva reserva', exact: true })).toBeVisible();
  await expect(page.getByText('Dashboard General')).toBeVisible();
});

test('defers optional attendance features until they are opened', async ({ page }) => {
  const optionalRequests = [];
  page.on('request', (request) => {
    if (/StaffQrScannerModal|AttendanceKioskModal/.test(request.url())) optionalRequests.push(request.url());
  });

  await page.goto('/#/personal');
  await expect(page.getByRole('heading', { name: 'Asistencia y turnos' })).toBeVisible({ timeout: 30000 });
  expect(optionalRequests).toEqual([]);

  await page.getByRole('button', { name: /Pantalla de Kiosco QR/ }).click();
  await expect(page.getByRole('dialog', { name: 'Kiosco de Asistencia · Hotel Park Plaza' })).toBeVisible();
  expect(optionalRequests.some((url) => url.includes('AttendanceKioskModal'))).toBe(true);
});

test('defers restaurant resources until their operational views open', async ({ page }) => {
  const resourceRequests = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/restaurant/menu' || path === '/api/restaurant/inventory/ledger') resourceRequests.push(path);
  });

  await page.goto('/');
  await expect(page.getByText('Dashboard General')).toBeVisible();
  expect(resourceRequests).toEqual([]);

  await page.goto('/#/pedidos-qr');
  await expect.poll(() => resourceRequests.includes('/api/restaurant/menu')).toBe(true);

  await page.goto('/#/inventario');
  await expect.poll(() => resourceRequests.includes('/api/restaurant/inventory/ledger')).toBe(true);
});

test('defers parking and pet resources until their operational views open', async ({ page }) => {
  const resourceRequests = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/parking' || path === '/api/pets') resourceRequests.push(path);
  });

  await page.goto('/');
  await expect(page.getByText('Dashboard General')).toBeVisible();
  expect(resourceRequests).toEqual([]);

  await page.goto('/#/cochera');
  await expect(page.getByRole('heading', { name: 'Cochera' })).toBeVisible();
  await expect.poll(() => resourceRequests.includes('/api/parking')).toBe(true);

  await page.goto('/#/mascotas');
  await expect(page.getByRole('heading', { name: 'Mascotas' })).toBeVisible();
  await expect.poll(() => resourceRequests.includes('/api/pets')).toBe(true);
});

test('moves keyboard focus from the skip link to the main content', async ({ page }) => {
  await page.goto('/');

  const skipLink = page.locator('.skip-link');
  const mainContent = page.locator('#main-content');
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(mainContent).toBeFocused();
});

test('keeps keyboard focus contained in navigation and search overlays', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');

  const menu = page.getByRole('button', { name: 'Abrir navegación' });
  await menu.click();
  await expect(page.getByRole('button', { name: 'Cerrar navegación' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 768 });
  await page.goto('/');

  const search = page.getByRole('button', { name: 'Buscar en el hotel' });
  await search.click();
  const dialog = page.getByRole('dialog', { name: 'Búsqueda global' });
  await expect(dialog.getByRole('combobox', { name: 'Buscar en el hotel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
});

test('defers the global search chunk until it is opened', async ({ page }) => {
  const searchChunks = [];
  page.on('request', (request) => {
    if (/\/assets\/GlobalSearch-[^/]+\.js$/.test(new URL(request.url()).pathname)) searchChunks.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByText('Dashboard General')).toBeVisible();
  expect(searchChunks).toEqual([]);

  await page.getByRole('button', { name: 'Buscar en el hotel' }).click();
  await expect(page.getByRole('dialog', { name: 'Búsqueda global' })).toBeVisible();
  await expect.poll(() => searchChunks.length).toBe(1);
});

test('keeps interactive targets at least 24px on narrow operational views', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 768 });

  for (const route of ['/', '/#/habitaciones', '/#/reservas', '/#/caja', '/#/cocina-bar', '/#/configuracion', '/#/roles']) {
    await page.goto(route);
    const undersizedTargets = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], input, select, textarea, a')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && (rect.width < 24 || rect.height < 24);
      })
      .map((element) => `${element.tagName}.${String(element.className)}`));

    expect(undersizedTargets, `undersized target(s) on ${route}`).toEqual([]);
  }
});

test('keeps operational views usable at a 200% zoom equivalent width', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 768 });

  for (const route of ['/', '/#/habitaciones', '/#/reservas', '/#/caja', '/#/cocina-bar', '/#/configuracion', '/#/roles']) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));

    expect(dimensions.documentWidth, `horizontal overflow on ${route}`).toBeLessThanOrEqual(dimensions.viewportWidth);
    await expect(page.locator('#main-content')).toBeVisible();
  }
});

for (const width of [320, 480, 640, 768, 1024, 1280]) {
  test(`keeps the authenticated shell usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');

    if (width <= 1024) {
      await expect(page.getByRole('button', { name: 'Abrir navegación' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    }
    await expect(page.locator('#main-content')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
}

test('loads rooms and the room amenities catalog', async ({ page }) => {
  await page.goto('/#/habitaciones');

  const status = await page.evaluate(async () => {
    const response = await fetch('/api/rooms/amenities', { credentials: 'include' });
    return response.status;
  });
  expect(status).toBe(200);
  await expect(page.getByRole('heading', { name: 'Inventario y Tarifas de Habitaciones' })).toBeVisible();
  await expect(page.getByText(/38 habitaciones/i).first()).toBeVisible();
});

test('loads persisted property settings', async ({ page }) => {
  await page.goto('/#/configuracion');

  await expect(page.getByText('Parámetros de la propiedad')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Conectado al Backend')).toBeVisible();
  await expect(page.getByText(/moneda PEN/i).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('opens the reservation form without persisting a reservation', async ({ page }) => {
  await page.goto('/#/reservas');

  await expect(page.getByRole('heading', { name: 'Reservas de Habitación' })).toBeVisible({ timeout: 30000 });
  await page.locator('#main-content').getByRole('button', { name: 'Nueva reserva', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Nueva Reserva de Habitación' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ingreso (Check-in)')).toBeVisible();
  await expect(dialog.getByText('+ Nuevo Huésped', { exact: true })).toBeVisible();
});

test('opens an available cash operation form without persisting a movement', async ({ page }) => {
  await page.goto('/#/caja');

  await expect(page.getByRole('heading', { name: 'Control de Caja & Turnos' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Caja Cerrada|Turno Activo:/).first()).toBeVisible({ timeout: 30000 });

  const openShift = page.getByRole('button', { name: 'Abrir nuevo turno de caja', exact: true });
  if (await openShift.isVisible()) {
    await openShift.click();
    await expect(page.getByRole('dialog', { name: 'Abrir nuevo turno de caja' })).toBeVisible();
    return;
  }

  await page.getByRole('button', { name: 'Movimiento', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Movimiento de Caja · Ingreso / Egreso' })).toBeVisible();
});

test('loads the kitchen and bar catalog filters', async ({ page }) => {
  await page.goto('/#/cocina-bar');

  await expect(page.getByRole('heading', { name: 'Cocina y Bar', exact: true })).toBeVisible({ timeout: 30000 });
  const listView = page.getByRole('button', { name: 'Lista', exact: true });
  await expect(listView).toBeVisible();
  await listView.click();
  await expect(listView).toHaveClass(/active/);
  await expect(page.getByText(/\d+ productos/)).toBeVisible();
});

test('opens the roles and permissions comparison matrix', async ({ page }) => {
  await page.goto('/#/roles');

  await expect(page.getByRole('heading', { name: 'Roles y permisos', exact: true, level: 1 })).toBeVisible({ timeout: 30000 });
  const matrixView = page.getByRole('button', { name: 'Matriz Comparativa', exact: true });
  await expect(matrixView).toBeVisible({ timeout: 30000 });
  await matrixView.click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Módulo o Alcance' })).toBeVisible();
});

test('exposes the authenticated account permissions needed by operational slices', async ({ adminApi }) => {
  const response = await adminApi.get('/api/auth/session');
  expect(response.ok()).toBeTruthy();

  const session = await response.json();
  expect(session.permissions).toEqual(expect.arrayContaining([
    'reservations.read',
    'cash.read',
    'cash.open',
    'cash.close',
    'orders.read',
    'orders.create',
    'orders.cancel',
  ]));
});

test('opens and closes an isolated cash session through the authoritative API', async ({ adminApi }) => {
  const activeResponse = await adminApi.get('/api/cash/session/active');
  expect(activeResponse.ok()).toBeTruthy();
  const activeSession = await activeResponse.json();
  test.skip(Boolean(activeSession), 'The property already has an active cash session.');

  const token = randomUUID();
  const openResponse = await adminApi.post('/api/cash/session/open', {
    headers: { 'Idempotency-Key': randomUUID() },
    data: {
      openingAmount: '0.00',
      responsible: `E2E ${token.slice(0, 8)}`,
      shift: 'E2E',
      notes: `Controlled Playwright fixture ${token}`,
    },
  });
  expect(openResponse.ok()).toBeTruthy();

  const session = await openResponse.json();
  try {
    expect(session.status).toBe('open');
    expect(session.openingAmount).toBe('0.00');
  } finally {
    const closeResponse = await adminApi.post(`/api/cash/session/close/${session.id}`, {
      headers: { 'Idempotency-Key': randomUUID() },
      data: { countedAmount: '0.00', note: 'Controlled E2E cleanup' },
    });
    await expect(closeResponse).toBeOK();
  }
});

test('creates and cancels an isolated restaurant order through the authoritative API', async ({ adminApi }) => {
  const menuResponse = await adminApi.get('/api/restaurant/menu');
  expect(menuResponse.ok()).toBeTruthy();
  const menu = await menuResponse.json();
  const item = menu.find((entry) => entry.status === 'active' && entry.isAvailable !== false && entry.salePrice !== null);
  test.skip(!item, 'The property has no available menu item for the controlled fixture.');

  const orderResponse = await adminApi.post('/api/restaurant/orders', {
    data: {
      source: 'E2E',
      stayId: null,
      items: [{ menuItemId: item.id, quantity: 1 }],
      paymentMethod: 'Efectivo',
      estimatedMinutes: 15,
      comment: `Controlled Playwright fixture ${randomUUID()}`,
    },
  });
  expect(orderResponse.ok()).toBeTruthy();

  const order = await orderResponse.json();
  try {
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(order.status).toBe('Pedido recibido');
  } finally {
    const cancelResponse = await adminApi.post(`/api/restaurant/orders/${order.id}/cancel`, {
      data: { reason: 'Controlled E2E cleanup' },
    });
    await expect(cancelResponse).toBeOK();
  }
});
