import { expect, test as setup } from '@playwright/test';

setup('authenticate QA account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(process.env.E2E_EMAIL);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  if (new URL(page.url()).protocol === 'http:') {
    const cookies = await page.context().cookies();
    await page.context().clearCookies();
    await page.context().addCookies(cookies.map((cookie) => ({ ...cookie, secure: false })));
  }
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
