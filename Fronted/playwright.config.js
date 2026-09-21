import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env.e2e.local')) {
  delete process.env.E2E_EMAIL;
  delete process.env.E2E_PASSWORD;
}

try {
  loadEnvFile('.env.e2e.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const hasQaCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const e2eApiPort = process.env.E2E_API_PORT || '3000';
const e2eApiUrl = `http://127.0.0.1:${e2eApiPort}`;
if (process.env.E2E_API_PORT) {
  process.env.API_PORT = e2eApiPort;
  process.env.VITE_API_PROXY_TARGET = e2eApiUrl;
}

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
      workers: 1,
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
      reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_EXISTING_SERVER === 'true',
      timeout: 120000,
    },
    {
      name: 'backend',
      command: 'npm run start:dev',
      cwd: '../Backend',
      url: `${e2eApiUrl}/api/auth/session`,
      reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_EXISTING_SERVER === 'true',
      timeout: 120000,
    },
  ],
});
