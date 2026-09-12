import { expect, test } from '@playwright/test';

test('renders the administrative login', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Correo electrónico' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Contraseña' })).toBeVisible();
});

test('shows an error for invalid credentials', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('qa.invalid@example.com');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('invalid-password');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('alert')).toHaveText('El correo electrónico o la contraseña son incorrectos.');
});
