import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smokeAssistant, verifyAssistantStream } from './smoke-assistant.mjs'
const response = text => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } })
const valid = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'
test('accepts complete SSE, including fragmented UTF-8 and CRLF', async () => {
  const chunks = new TextEncoder().encode(valid.replace('Hello', 'Héllo'))
  const body = new ReadableStream({ start(controller) { for (const byte of chunks) controller.enqueue(Uint8Array.of(byte)); controller.close() } })
  await verifyAssistantStream(response(body))
})
for (const [name, input] of [
  ['missing credentials', new Response('{}', { status: 503 })],
  ['SPA rewrite', new Response('<html>app</html>')],
  ['truncated output', response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')],
  ['empty stream', response('data: [DONE]\n\n')],
  ['provider stream error', response('data: {"error":{"message":"private"}}\n\n')],
]) test(`fails on ${name}`, async () => { await assert.rejects(verifyAssistantStream(input)) })
test('does not skip when the deployment URL is absent', async () => {
  await assert.rejects(smokeAssistant({}), /required/)
})
test('retries transient quota failures then validates a complete response', async () => {
  let calls = 0
  await smokeAssistant({ baseURL: 'https://ucblogo-preview.vercel.app', secret: 'test-only', sleep: async () => {}, log() {}, fetcher: async (url, init) => {
    assert.equal(url.origin, init.headers.Origin)
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers['x-vercel-protection-bypass'], 'test-only')
    return ++calls < 2 ? new Response('', { status: 429 }) : response(valid)
  } })
  assert.equal(calls, 2)
})
test('never retries missing configuration or sends credentials to a foreign origin', async () => {
  let calls = 0
  await assert.rejects(smokeAssistant({ baseURL: 'https://ucblogo-preview.vercel.app', fetcher: async () => { calls++; return new Response('{}', { status: 503 }) } }), /503/)
  assert.equal(calls, 1)
  await assert.rejects(smokeAssistant({ baseURL: 'https://attacker.test', secret: 'test-only' }), /Vercel deployment/)
})
