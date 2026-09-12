import { defineConfig, devices } from '@playwright/test';

const hasQaCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    testIgnore: /auth\.setup\.js|authenticated\.spec\.js/,
  },
];

if (hasQaCredentials) {
  projects.push(
    { name: 'auth-setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'authenticated',
      testMatch: /authenticated\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
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
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
  webServer: [
    {
      name: 'frontend',
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: '.',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      name: 'backend',
      command: 'npm run start:dev',
      cwd: '../Backend',
      url: 'http://127.0.0.1:3000/api/auth/session',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
