import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { defineAgent } from 'eve'
import { defineDynamic } from 'eve/models'

/** The default teacher model. A plain id like this is served by Vercel AI Gateway. */
export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash'

export default defineAgent({
  // Resolved when a turn runs, so PIP_MODEL can change without touching code.
  model: defineDynamic(() => {
    const id = process.env.PIP_MODEL || DEFAULT_MODEL
    const endpoint = process.env.PIP_MODEL_BASE_URL
    // On Vercel the deployment reaches AI Gateway with its own OIDC identity:
    // there is no provider key to configure or leak.
    if (!endpoint) return id
    // Any OpenAI-compatible endpoint can stand in: a local model, another router,
    // or the scripted model the browser tests use.
    const provider = createOpenAICompatible({ name: 'pip-custom', baseURL: endpoint, apiKey: process.env.PIP_MODEL_API_KEY, includeUsage: true })
    return { model: provider(id), modelContextWindowTokens: 128_000 }
  }),
  reasoning: 'low',
  // Pip teaches with three tools of its own. It gets no shell, files, or web access.
  defaultTools: false,
  limits: {
    // One classroom conversation may spend this much before Pip asks whether to go on.
    sessionUsage: ({ window }) => window.inputTokens - window.cacheReadTokens >= 1_500_000 || window.outputTokens >= 150_000,
    sessionTimeoutMs: 24 * 60 * 60 * 1000,
  },
})
