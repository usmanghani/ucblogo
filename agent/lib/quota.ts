import { checkRateLimit } from '@vercel/firewall'

/** Resolves to a reason when the request must be refused, or undefined when it may proceed. */
export type QuotaCheck = (request: Request) => Promise<'limited' | 'unavailable' | undefined>

// Shared Vercel Firewall counters survive cold starts and span function instances.
// Counters are scoped per region, so the agent is pinned to one region in vercel.ts.
export const checkTeacherQuota: QuotaCheck = async request => {
  // Outside Vercel there is no shared counter to consult: local development and self-hosted runs.
  if (process.env.VERCEL !== '1') return
  let ruleId = 'pip-assistant-ip'
  try {
    for (const [id, key] of [['pip-assistant-ip', undefined], ['pip-assistant-global', 'all-users']] as const) {
      ruleId = id
      const result = await checkRateLimit(id, { request, ...(key ? { rateLimitKey: key } : {}) })
      if (result.error === 'not-found') {
        // The rule has not been created in the project's Firewall yet. Refuse rather than run
        // an unmetered public model endpoint; docs/pip.md explains how to add the two rules.
        console.error(`Pip quota rule is missing: ${id}`)
        return 'unavailable'
      }
      if (result.rateLimited || result.error === 'blocked') return 'limited'
    }
  } catch (error) {
    // Log only the SDK's numeric status. Never log request headers, prompts or credentials.
    const message = error instanceof Error ? error.message : ''
    const status = /^Unexpected rate-limit API response status '[a-z-]+': (\d{3})$/.exec(message)?.[1]
    console.error('Pip quota service is unavailable; the turn was not started', {
      ruleId,
      reason: status ? 'unexpected-http-status' : message.startsWith('Could not determine rate limit key.') ? 'missing-client-ip' : 'sdk-error',
      httpStatus: status ? Number(status) : undefined,
    })
    return 'unavailable'
  }
}
