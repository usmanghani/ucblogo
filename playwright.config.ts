import { defineConfig, devices } from '@playwright/test'

const remote = process.env.PLAYWRIGHT_BASE_URL
const FAKE_MODEL_PORT = 4319

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
  webServer: remote ? undefined : [
    {
      command: 'node e2e/fake-model.mjs',
      url: `http://127.0.0.1:${FAKE_MODEL_PORT}`,
      env: { FAKE_MODEL_PORT: String(FAKE_MODEL_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/eve/v1/health',
      env: { PIP_MODEL_BASE_URL: `http://127.0.0.1:${FAKE_MODEL_PORT}/v1` },
      reuseExistingServer: !process.env.CI,
      timeout: 240000,
    },
  ],
})
