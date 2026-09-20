import { request } from '@playwright/test'

export default async function checkPreview() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) return
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const client = await request.newContext()
  try {
    const response = await client.get(baseURL, {
      maxRedirects: 0,
      headers: secret ? { 'x-vercel-protection-bypass': secret } : {},
    })
    const location = response.headers().location || ''
    if (response.status() === 401 || response.status() === 403 || location.includes('vercel.com')) {
      throw new Error('Vercel preview requires authentication. Configure VERCEL_AUTOMATION_BYPASS_SECRET in GitHub Actions using Vercel Protection Bypass for Automation. Preview tests cannot pass until access is configured.')
    }
    if (response.status() >= 400) throw new Error(`Vercel preview returned HTTP ${response.status()}`)
  } finally {
    await client.dispose()
  }
}
