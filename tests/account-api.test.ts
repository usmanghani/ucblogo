// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { handleAccount, handlePrograms, handleProgress, MAX_PROGRAMS } from '../server/api'
import { resetBackend } from '../server/db'

// The real handlers, Better Auth and SQL, against an in-process Postgres.
const PORT = 54331
let db: PGlite, server: PGLiteSocketServer

beforeAll(async () => {
  db = await PGlite.create()
  server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' })
  await server.start()
  vi.stubEnv('DATABASE_URL', `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`)
  vi.stubEnv('DATABASE_POOL_MAX', '1')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-9f2c7a1e5b8d4c3f6a0e1d2b7c8f9a4e')
}, 60_000)
afterAll(async () => { await resetBackend(); await server.stop(); await db.close(); vi.unstubAllEnvs() })

const call = (handler: (request: Request) => Promise<Response>, path: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) =>
  handler(new Request(`https://logo.example${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  }))
const cookieOf = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')

async function signUp(email: string, name = 'Ada') {
  const response = await call(handleAccount, '/api/account', { method: 'POST', body: { action: 'sign-up', name, email, password: 'turtle-power-1' } })
  expect(response.status).toBe(200)
  return cookieOf(response)
}

describe('accounts', () => {
  it('reports no one signed in to an anonymous visitor', async () => {
    expect(await (await call(handleAccount, '/api/account')).json()).toEqual({ accounts: true, user: null })
  })
  it('signs up, stays signed in by cookie, signs out, and signs in again', async () => {
    const cookie = await signUp('ada@example.com')
    expect(cookie).toContain('session_token')
    expect(await (await call(handleAccount, '/api/account', { cookie })).json()).toEqual({ accounts: true, user: { name: 'Ada', email: 'ada@example.com' } })
    const out = await call(handleAccount, '/api/account', { method: 'POST', body: { action: 'sign-out' }, cookie })
    expect(out.status).toBe(200)
    expect((await (await call(handleAccount, '/api/account', { cookie })).json()).user).toBeNull()
    const back = await call(handleAccount, '/api/account', { method: 'POST', body: { action: 'sign-in', email: ' ADA@example.com ', password: 'turtle-power-1' } })
    expect(await back.json()).toEqual({ user: { name: 'Ada', email: 'ada@example.com' } })
    expect(cookieOf(back)).toContain('session_token')
  })
  it('explains what went wrong in plain words, and never says which half of a login was wrong', async () => {
    await signUp('grace@example.com', 'Grace')
    const post = async (body: unknown) => { const r = await call(handleAccount, '/api/account', { method: 'POST', body }); return [r.status, (await r.json()).error] }
    expect(await post({ action: 'sign-in', email: 'grace@example.com', password: 'wrong-password' })).toEqual([400, 'That email and password do not match an account.'])
    expect(await post({ action: 'sign-in', email: 'nobody@example.com', password: 'wrong-password' })).toEqual([400, 'That email and password do not match an account.'])
    expect(await post({ action: 'sign-up', name: 'G', email: 'grace@example.com', password: 'turtle-power-1' })).toEqual([400, 'There is already an account with that email. Try signing in.'])
    expect(await post({ action: 'sign-up', name: 'G', email: 'new@example.com', password: 'short' })).toEqual([400, 'Use a password with at least 8 characters.'])
    expect(await post({ action: 'sign-up', email: 'new@example.com', password: 'turtle-power-1' })).toEqual([400, 'Enter a name for Pip to call you.'])
    expect(await post({ action: 'sign-in', email: 'grace@example.com' })).toEqual([400, 'Enter your email and password.'])
    expect(await post({ action: 'dance' })).toEqual([400, 'Enter your email and password.'])
  })
  it('refuses writes from other sites and slows repeated tries', async () => {
    const body = { action: 'sign-in', email: 'ada@example.com', password: 'turtle-power-1' }
    expect((await call(handleAccount, '/api/account', { method: 'POST', body, headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403)
    const limited = await handleAccount(new Request('https://logo.example/api/account', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify(body) }), { throttle: async () => 'limited' })
    expect(limited.status).toBe(429)
  })
})

describe('saved programs', () => {
  it('needs a signed-in student', async () => {
    expect((await call(handlePrograms, '/api/programs')).status).toBe(401)
    expect((await call(handleProgress, '/api/progress')).status).toBe(401)
  })
  it('saves, lists, renames and deletes a student’s own programs', async () => {
    const cookie = await signUp('saver@example.com')
    const made = await call(handlePrograms, '/api/programs', { method: 'POST', cookie, body: { title: '  My house ', source: 'CS\nREPEAT 4 [FD 50 RT 90]' } })
    expect(made.status).toBe(201)
    const { program } = await made.json()
    expect(program).toMatchObject({ title: 'My house', source: 'CS\nREPEAT 4 [FD 50 RT 90]' })
    expect((await (await call(handlePrograms, '/api/programs', { cookie })).json()).programs).toEqual([program])
    const renamed = await call(handlePrograms, `/api/programs?id=${program.id}`, { method: 'PUT', cookie, body: { title: 'Big house', source: 'FD 100' } })
    expect((await renamed.json()).program).toMatchObject({ id: program.id, title: 'Big house', source: 'FD 100' })
    expect((await call(handlePrograms, `/api/programs?id=${program.id}`, { method: 'DELETE', cookie })).status).toBe(200)
    expect((await (await call(handlePrograms, '/api/programs', { cookie })).json()).programs).toEqual([])
  })
  it('keeps one student’s programs out of another’s reach', async () => {
    const mine = await signUp('owner@example.com')
    const theirs = await signUp('other@example.com')
    const { program } = await (await call(handlePrograms, '/api/programs', { method: 'POST', cookie: mine, body: { title: 'Secret spiral', source: 'FD 1' } })).json()
    expect((await (await call(handlePrograms, '/api/programs', { cookie: theirs })).json()).programs).toEqual([])
    expect((await call(handlePrograms, `/api/programs?id=${program.id}`, { method: 'PUT', cookie: theirs, body: { title: 'Mine now', source: 'FD 2' } })).status).toBe(404)
    expect((await call(handlePrograms, `/api/programs?id=${program.id}`, { method: 'DELETE', cookie: theirs })).status).toBe(404)
    expect((await (await call(handlePrograms, '/api/programs', { cookie: mine })).json()).programs[0]).toMatchObject({ title: 'Secret spiral', source: 'FD 1' })
  })
  it('validates what it stores and caps how much one student can keep', async () => {
    const cookie = await signUp('limits@example.com')
    const post = (body: unknown) => call(handlePrograms, '/api/programs', { method: 'POST', cookie, body }).then(r => r.status)
    expect(await post({ title: '', source: 'FD 1' })).toBe(400)
    expect(await post({ title: 'x'.repeat(81), source: 'FD 1' })).toBe(400)
    expect(await post({ title: 'ok', source: '   ' })).toBe(400)
    expect(await post({ title: 'ok', source: 'x'.repeat(30_001) })).toBe(400)
    expect(await post({ title: 'ok', source: 7 })).toBe(400)
    expect((await call(handlePrograms, '/api/programs?id=not-an-id', { method: 'DELETE', cookie })).status).toBe(400)
    for (let i = 0; i < MAX_PROGRAMS; i++) expect(await post({ title: `p${i}`, source: 'FD 1' })).toBe(201)
    expect(await post({ title: 'one too many', source: 'FD 1' })).toBe(409)
  }, 60_000)
})

describe('lesson progress', () => {
  it('adds finished lessons, ignores unknown ones, and never forgets', async () => {
    const cookie = await signUp('learner@example.com')
    expect(await (await call(handleProgress, '/api/progress', { cookie })).json()).toEqual({ completed: [] })
    const put = async (completed: unknown) => (await (await call(handleProgress, '/api/progress', { method: 'PUT', cookie, body: { completed } })).json()).completed
    expect(await put(['repeat', 'made-up', 7, 'repeat'])).toEqual(['repeat'])
    expect(await put(['meet-the-turtle'])).toEqual(['meet-the-turtle', 'repeat'])
    expect(await put([])).toEqual(['meet-the-turtle', 'repeat'])
    expect(await put('everything')).toEqual(['meet-the-turtle', 'repeat'])
  })
})

describe('a site without accounts', () => {
  it('says so without touching a database, and the page can carry on anonymously', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    expect(await (await call(handleAccount, '/api/account')).json()).toEqual({ accounts: false, user: null })
    expect((await call(handlePrograms, '/api/programs')).status).toBe(503)
    expect((await call(handleAccount, '/api/account', { method: 'POST', body: { action: 'sign-in', email: 'a@b.co', password: 'x' } })).status).toBe(503)
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-9f2c7a1e5b8d4c3f6a0e1d2b7c8f9a4e')
  })
})
