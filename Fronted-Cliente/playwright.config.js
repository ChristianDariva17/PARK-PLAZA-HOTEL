import { defineConfig, devices } from '@playwright/test';

const hasCustomerCredentials = Boolean(
  process.env.CUSTOMER_E2E_EMAIL && process.env.CUSTOMER_E2E_PASSWORD,
);

const projects = [
  {
    name: 'customer-public',
    testMatch: /public\.spec\.js/,
    use: { ...devices['Desktop Chrome'] },
  },
];

if (hasCustomerCredentials) {
  projects.push(
    {
      name: 'customer-auth-setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'customer-authenticated',
      testMatch: /authenticated\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/customer.json',
      },
      dependencies: ['customer-auth-setup'],
    },
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.CUSTOMER_E2E_BASE_URL || 'http://127.0.0.1:5174',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
  webServer: [
    {
      name: 'customer-frontend',
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      cwd: '.',
      url: 'http://127.0.0.1:5174',
      env: { VITE_E2E_ANONYMOUS: hasCustomerCredentials ? 'false' : 'true' },
      reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_EXISTING_SERVER === 'true',
      timeout: 120000,
    },
    {
      name: 'backend',
      command: process.env.CUSTOMER_E2E_MUTATIONS === 'true' ? 'npm start' : 'npm run start:dev',
      cwd: '../Backend',
      url: 'http://127.0.0.1:3000/api/health/live',
      reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_EXISTING_SERVER === 'true',
      timeout: 120000,
    },
  ],
});
