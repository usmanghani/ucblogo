import { defineConfig, devices } from '@playwright/test'

const remote = process.env.PLAYWRIGHT_BASE_URL
const FAKE_MODEL_PORT = 4319
const TEST_DB_PORT = 54329

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/check-preview.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/browser.xml' }]],
  use: {
    baseURL: remote || 'http://127.0.0.1:4173',
    trace: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Locally the page is served by `vite preview`, whose eve plugin runs Pip beside it.
  // Pip talks to a scripted model, so the whole loop is real except the language model.
  // Accounts use an in-process Postgres, so sign-up, sessions and SQL are real too.
  webServer: remote ? undefined : [
    {
      command: 'node e2e/fake-model.mjs',
      url: `http://127.0.0.1:${FAKE_MODEL_PORT}`,
      env: { FAKE_MODEL_PORT: String(FAKE_MODEL_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/test-db.mjs',
      url: `http://127.0.0.1:${TEST_DB_PORT + 1}`,
      env: { TEST_DB_PORT: String(TEST_DB_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/eve/v1/health',
      env: {
        PIP_MODEL_BASE_URL: `http://127.0.0.1:${FAKE_MODEL_PORT}/v1`,
        DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres`,
        DATABASE_POOL_MAX: '1', // the in-process database serves one connection at a time
        BETTER_AUTH_SECRET: 'browser-tests-only-3e9b1f7a2c5d8e4b6a0f1c2d',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240000,
    },
  ],
})
