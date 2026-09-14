import { expect, test } from '@playwright/test';

const anonymousSession = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/customer/auth/session', (route) => route.fulfill(anonymousSession));
});

test('renders the public resort experience', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Alojamientos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Habitaciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar Sesión' }).last()).toBeVisible();
});

test('validates booking dates before navigating', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="date"]').nth(0).fill('2030-09-15');
  await page.locator('input[type="date"]').nth(1).fill('2030-09-14');

  const dialogPromise = page.waitForEvent('dialog');
  await Promise.all([
    page.getByRole('button', { name: 'Buscar' }).click(),
    dialogPromise.then(async (dialog) => {
      expect(dialog.message()).toBe('La salida debe ser posterior a la llegada.');
      await dialog.accept();
    }),
  ]);
  await expect(page).toHaveURL(/127\.0\.0\.1:5174\/$/);
});

test('shows availability and sends anonymous booking attempts to login', async ({ page }) => {
  await page.route('**/api/customer/reservations/amenities', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ master: [], categoryAmenities: {} }),
  }));
  await page.route('**/api/customer/reservations/availability**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      currency: 'PEN',
      categories: [{ id: 'category-1', code: 'SIMPLE', name: 'Simple', capacity: 1, totalAmount: '95.00' }],
    }),
  }));

  await page.goto('/habitaciones?checkIn=2030-09-15&checkOut=2030-09-16&guests=1');
  await expect(page.getByRole('button', { name: 'Reservar ahora' })).toBeVisible();
  await page.getByRole('button', { name: 'Reservar ahora' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
});

test('shows a Firebase login error without contacting the real identity service', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } }),
  }));

  await page.goto('/login');
  await page.locator('#login-email').fill('invalid@example.test');
  await page.locator('#login-pass').fill('invalid-password');
  await page.locator('form.auth-form button[type="submit"]').click();

  await expect(page.getByText('Fallo al iniciar sesión. Verifica tus credenciales.')).toBeVisible();
});
