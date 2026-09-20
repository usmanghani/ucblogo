import { test as base, expect } from '@playwright/test'

// Scope Vercel automation credentials to this deployment origin only.
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (secret && baseURL) {
      const origin = new URL(baseURL).origin
      await page.route('**/*', async route => {
        if (new URL(route.request().url()).origin === origin) {
          await route.continue({ headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret } })
        } else {
          await route.continue()
        }
      })
    }
    await use(page)
  },
})
export { expect }
