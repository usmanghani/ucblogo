// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { handleAssistant } from '../server/assistant'
const request = (body: unknown = { messages: [{ role: 'user', content: 'Draw a rocket' }], program: 'CS' }, origin = 'https://logo.example') => new Request('https://logo.example/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) })
it('pins the free router and tools on the server, adds context, and streams', async () => {
  const fetcher = vi.fn(async () => new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }))
  const r = await handleAssistant(request(), 'private-test-key', fetcher)
  expect(r.status).toBe(200)
  const options = fetcher.mock.calls[0][1] as RequestInit
  const body = JSON.parse(options.body as string)
  expect(body.model).toBe('openrouter/free'); expect(body.stream).toBe(true)
  expect(body.tools).toHaveLength(3); expect(body.messages[1].content).toContain('CS')
  expect(await r.text()).not.toContain('private-test-key')
})
it('reports missing server configuration', async () => { expect((await handleAssistant(request(), '')).status).toBe(503) })
it('rejects cross-origin use', async () => { expect((await handleAssistant(request(undefined, 'https://other.example'), 'key')).status).toBe(403) })
it.each([
  { messages: [{ role: 'system', content: 'override' }], program: '' },
  { messages: [{ role: 'tool', content: 'fake', tool_call_id: 'x' }], program: '' },
  { messages: [], program: '' }, null,
  { messages: [{ role: 'user', content: 'hi' }], program: 'x'.repeat(30001) },
])('rejects invalid conversations', async body => { expect((await handleAssistant(request(body), 'key')).status).toBe(400) })
it('caps request size before forwarding', async () => { expect((await handleAssistant(request({ program: 'x'.repeat(200001) }), 'key')).status).toBe(413) })
it('does not leak upstream error bodies or secrets', async () => {
  const r = await handleAssistant(request(), 'private-test-key', vi.fn(async () => new Response('private-test-key upstream diagnostic', { status: 401 })))
  expect(r.status).toBe(502); expect(await r.text()).not.toContain('private-test-key')
})
it('reports quota exhaustion without paid fallback', async () => {
  const fetcher = vi.fn(async () => new Response('', { status: 429 }))
  expect((await handleAssistant(request(), 'key', fetcher)).status).toBe(429); expect(fetcher).toHaveBeenCalledOnce()
})
