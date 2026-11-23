import { defineAgent } from 'eve'

/** Served by Vercel AI Gateway; the deployment signs in with its own OIDC identity, so there is no key. */
export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash-1017'

export default defineAgent({
  model: process.env.REVIEW_MODEL || DEFAULT_MODEL,
  reasoning: 'high',
  limits: {
    // One review may read a lot of code, but not without end.
    sessionUsage: ({ window }) => window.inputTokens - window.cacheReadTokens >= 3_000_000 || window.outputTokens >= 200_000,
    sessionTimeoutMs: 60 * 60 * 1000,
  },
})
