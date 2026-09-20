// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkRateLimit } from '@vercel/firewall'
import { checkAssistantQuota } from '../server/rate-limit'
vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }))
const check = vi.mocked(checkRateLimit)
const request = () => new Request('https://ucblogo.vercel.app/api/assistant')
beforeEach(() => { vi.stubEnv('VERCEL', '1'); vi.stubEnv('NODE_ENV', 'production'); check.mockReset(); check.mockResolvedValue({ rateLimited: false }) })
afterEach(() => vi.unstubAllEnvs())
it('enforces per-IP and shared quotas before allowing inference', async () => {
  const req = request()
  expect(await checkAssistantQuota(req)).toBeUndefined()
  expect(check).toHaveBeenNthCalledWith(1, 'pip-assistant-ip', { request: req })
  expect(check).toHaveBeenNthCalledWith(2, 'pip-assistant-global', { request: req, rateLimitKey: 'all-users' })
})
it.each(['ip', 'global'])('returns 429 when the %s quota is exhausted', async scope => {
  if (scope === 'global') check.mockResolvedValueOnce({ rateLimited: false })
  check.mockResolvedValueOnce({ rateLimited: true })
  const response = await checkAssistantQuota(request())
  expect(response?.status).toBe(429)
  expect(response?.headers.get('retry-after')).toBe('60')
})
it('fails closed when the rule does not exist even though the SDK reports rateLimited=false', async () => {
  check.mockResolvedValue({ rateLimited: false, error: 'not-found' })
  expect((await checkAssistantQuota(request()))?.status).toBe(503)
})
it('fails closed on firewall outages without leaking error details', async () => {
  check.mockRejectedValue(new Error('private credential'))
  const response = await checkAssistantQuota(request())
  expect(response?.status).toBe(503)
  expect(await response?.text()).not.toContain('private credential')
})
it('does not use the SDK development bypass on deployed functions', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  expect((await checkAssistantQuota(request()))?.status).toBe(503)
  expect(check).not.toHaveBeenCalled()
})
it('only exempts loopback development outside Vercel', async () => {
  vi.stubEnv('VERCEL', '')
  expect(await checkAssistantQuota(new Request('http://127.0.0.1:4173/api/assistant'))).toBeUndefined()
  expect((await checkAssistantQuota(request()))?.status).toBe(503)
  expect(check).not.toHaveBeenCalled()
})
