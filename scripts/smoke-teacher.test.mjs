import { test } from 'node:test'
import assert from 'node:assert/strict'
import { smokeTeacher, verifyTurn } from './smoke-teacher.mjs'

const good = [
  { type: 'model.started', data: { modelId: 'deepseek/deepseek-v4.1-flash' } },
  { type: 'content.completed', data: { kind: 'text', value: 'Hello there!' } },
  { type: 'turn.settled', data: { outcome: 'completed' } },
]
const stream = events => ({ stream: async function* () { yield* events } })
const clientFor = (events, seen = {}) => async options => { Object.assign(seen, options); return { sessions: { create: async input => { seen.input = input; return { delivery: stream(events) } } } } }

test('accepts a completed turn with a reply and reports the model', () => {
  assert.deepEqual(verifyTurn(good), { reply: 'Hello there!', model: 'deepseek/deepseek-v4.1-flash' })
})
for (const [name, events, expected] of [
  ['a turn that never finished', good.slice(0, 2), /never finished/],
  ['missing gateway credentials', [{ type: 'model.settled', data: { outcome: 'failed', error: { code: 'MODEL_CALL_FAILED', message: 'AI Gateway received no credentials.' } } }, { type: 'turn.settled', data: { outcome: 'cancelled' } }], /MODEL_CALL_FAILED/],
  ['a cancelled turn', [{ type: 'turn.settled', data: { outcome: 'cancelled' } }], /cancelled/],
  ['a silent turn', [{ type: 'turn.settled', data: { outcome: 'completed' } }], /without saying anything/],
]) test(`fails on ${name}`, () => { assert.throws(() => verifyTurn(events), expected) })

test('does not skip when the deployment URL is absent', async () => {
  await assert.rejects(smokeTeacher({}), /required/)
})
test('only talks to an HTTPS Vercel deployment, and sends the bypass secret there alone', async () => {
  await assert.rejects(smokeTeacher({ baseURL: 'https://attacker.test', secret: 'test-only' }), /Vercel deployment/)
  await assert.rejects(smokeTeacher({ baseURL: 'http://logo.vercel.app' }), /Vercel deployment/)
  const seen = {}
  await smokeTeacher({ baseURL: 'https://logo-preview.vercel.app/some/path', secret: 'test-only', createClient: clientFor(good, seen), log() {} })
  assert.equal(seen.baseUrl, 'https://logo-preview.vercel.app')
  assert.deepEqual(seen.headers, { origin: 'https://logo-preview.vercel.app', 'x-vercel-protection-bypass': 'test-only' })
  assert.equal(seen.input.clientContext.program, '')
})
test('retries a busy teacher, but not a misconfigured one', async () => {
  let calls = 0
  const busy = Object.assign(new Error('Pip is helping a lot of students right now.'), { status: 401 })
  const flaky = async () => ({ sessions: { create: async () => { if (++calls < 2) throw busy; return { delivery: stream(good) } } } })
  await smokeTeacher({ baseURL: 'https://logo-preview.vercel.app', createClient: flaky, sleep: async () => {}, log() {} })
  assert.equal(calls, 2)
  calls = 0
  const broken = async () => ({ sessions: { create: async () => { calls++; throw Object.assign(new Error('Pip is not set up yet'), { status: 401 }) } } })
  await assert.rejects(smokeTeacher({ baseURL: 'https://logo-preview.vercel.app', createClient: broken, sleep: async () => {}, log() {} }), /not set up/)
  assert.equal(calls, 1)
})
