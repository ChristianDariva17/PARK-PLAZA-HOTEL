import { expect, test as setup } from '@playwright/test';

setup('authenticate customer QA account', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill(process.env.CUSTOMER_E2E_EMAIL);
  await page.locator('#login-pass').fill(process.env.CUSTOMER_E2E_PASSWORD);
  await page.locator('form.auth-form button[type="submit"]').click();

  await expect(page.getByTitle('Cerrar Sesión')).toBeVisible();
  await page.context().storageState({ path: 'playwright/.auth/customer.json' });
});
