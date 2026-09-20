import { checkRateLimit } from '@vercel/firewall'

export type QuotaCheck = (request: Request) => Promise<Response | undefined>

// Shared Vercel counters survive cold starts and multiple function instances.
// The function is pinned to iad1 because Vercel counters are scoped per region.
export const checkAssistantQuota: QuotaCheck = async request => {
  const url = new URL(request.url)
  if (process.env.VERCEL !== '1' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return
  const unavailable = () => Response.json({ error: 'Pip is temporarily unavailable. Please try again later.' }, {
    status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
  })
  // The SDK otherwise bypasses limits outside NODE_ENV=production.
  if (process.env.VERCEL !== '1' || process.env.NODE_ENV !== 'production') {
    console.error('Pip quota check refused an unexpected server environment')
    return unavailable()
  }
  try {
    for (const [id, key] of [['pip-assistant-ip', undefined], ['pip-assistant-global', 'all-users']] as const) {
      const result = await checkRateLimit(id, { request, ...(key ? { rateLimitKey: key } : {}) })
      if (result.error === 'not-found') {
        console.error(`Pip quota rule is missing: ${id}`)
        return unavailable()
      }
      if (result.rateLimited || result.error === 'blocked') return Response.json({ error: 'Pip is busy. Please wait a minute before trying again.' }, {
        status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      })
    }
  } catch {
    // Do not log headers, provider credentials, prompts, or upstream bodies.
    console.error('Pip quota service is unavailable; inference was not started')
    return unavailable()
  }
}
