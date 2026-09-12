import { expect, test } from '@playwright/test';

test('opens the administrative dashboard with a valid session', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByText('Dashboard General')).toBeVisible();
});

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
