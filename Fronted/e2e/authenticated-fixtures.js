import { test as base } from '@playwright/test';

export * from '@playwright/test';

export const test = base.extend({
  adminApi: async ({ baseURL, playwright }, use) => {
    const api = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/admin.json',
    });

    try {
      // Playwright names this fixture callback `use`; it is not a React Hook.
      // oxlint-disable-next-line react-hooks/rules-of-hooks
      await use(api);
    } finally {
      await api.dispose();
    }
  },
});
