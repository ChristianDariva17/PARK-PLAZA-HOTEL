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

test('keeps the login form keyboard navigable with an explicit focus order', async ({ page }) => {
  await page.goto('/');

  const email = page.getByRole('textbox', { name: 'Correo electrónico' });
  const password = page.getByRole('textbox', { name: 'Contraseña' });
  const submit = page.getByRole('button', { name: 'Ingresar' });

  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});

test('keeps the login usable with reduced motion and forced colors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  const audit = await page.evaluate(() => {
    const motionViolations = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0) || style.display === 'none' || style.visibility === 'hidden') return false;
      const durations = [...style.animationDuration.split(','), ...style.transitionDuration.split(',')].map((value) => {
        const number = Number.parseFloat(value);
        return value.includes('ms') ? number : number * 1000;
      });
      return Math.max(...durations, 0) > 0.01;
    });
    return {
      motionViolations: motionViolations.length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      unnamedButtons: [...document.querySelectorAll('button')].filter((button) => !(button.getAttribute('aria-label') || button.textContent.trim())).length,
    };
  });

  expect(audit.motionViolations).toBe(0);
  expect(audit.horizontalOverflow).toBe(false);
  expect(audit.unnamedButtons).toBe(0);
});

for (const width of [320, 480, 640, 768, 1024, 1280]) {
  test(`keeps the login usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Correo electrónico' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
}
