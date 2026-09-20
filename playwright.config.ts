import { defineConfig, devices } from '@playwright/test'

const remote = process.env.PLAYWRIGHT_BASE_URL
export default defineConfig({
  testDir: './e2e',
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
  webServer: remote ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
