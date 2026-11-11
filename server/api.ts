import { randomUUID } from 'node:crypto'
import { accountsConfigured, getBackend, type Backend } from './db.js'
import { lessons } from '../src/teacher/lessons.js'

export const MAX_TITLE = 80
export const MAX_SOURCE = 30_000
export const MAX_PROGRAMS = 100
const MAX_BODY_BYTES = 100_000

/** Resolves to a reason when a request must be refused. Shared with the agent's quota. */
export type Throttle = (request: Request) => Promise<'limited' | 'unavailable' | undefined>
export interface ApiOptions { throttle?: Throttle }

const json = (body: unknown, status = 200, headers?: Headers) => {
  const out = new Headers(headers)
  out.set('Content-Type', 'application/json')
  out.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers: out })
}
const fail = (message: string, status: number) => json({ error: message }, status)

/** Cookies make these routes a target for other sites, so writes must come from our own pages. */
function sameSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const host = new URL(origin).host
    return host === request.headers.get('x-forwarded-host') || host === request.headers.get('host') || host === new URL(request.url).host
  } catch { return false }
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const text = await request.text().catch(() => '')
  if (text.length > MAX_BODY_BYTES) return fail('That is too much to save at once.', 413)
  try {
    const body: unknown = JSON.parse(text || '{}')
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch { /* fall through */ }
  return fail('Expected a JSON object.', 400)
}

const text = (value: unknown, limit: number): string | null => (typeof value === 'string' && value.length <= limit ? value : null)

interface Caller { backend: Backend; userId: string; name: string; email: string }

/** Common front door: method allowed, same-site for writes, accounts configured, and who is asking. */
async function enter(request: Request, methods: string[], needUser: boolean): Promise<Response | { backend: Backend; caller: Caller | null }> {
  if (!methods.includes(request.method)) return fail('Method not allowed.', 405)
  if (request.method !== 'GET' && !sameSite(request)) return fail('Logo Teacher only answers its own pages.', 403)
  if (!accountsConfigured()) return fail('Accounts are not set up on this site.', 503)
  let backend: Backend
  try { backend = await getBackend(new URL(request.url).origin) } catch (error) {
    console.error('Account storage is unavailable', { reason: error instanceof Error ? error.name : 'unknown' })
    return fail('Accounts are unavailable right now. Try again in a moment.', 503)
  }
  const session = await backend.auth.api.getSession({ headers: request.headers }).catch(() => null)
  const caller = session ? { backend, userId: session.user.id, name: session.user.name, email: session.user.email } : null
  if (needUser && !caller) return fail('Sign in first.', 401)
  return { backend, caller }
}

/** Pass on an auth response's cookies with a body shaped for this app. */
async function authResult(response: Response, onSuccess: (data: { user?: { name?: string; email?: string } }) => unknown): Promise<Response> {
  const data = await response.json().catch(() => ({})) as { message?: string; code?: string; user?: { name?: string; email?: string } }
  const headers = new Headers()
  for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie)
  if (response.ok) return json(onSuccess(data), 200, headers)
  const friendly: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match an account.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'There is already an account with that email. Try signing in.',
    USER_ALREADY_EXISTS: 'There is already an account with that email. Try signing in.',
    PASSWORD_TOO_SHORT: 'Use a password with at least 8 characters.',
    PASSWORD_TOO_LONG: 'That password is too long.',
    INVALID_EMAIL: 'That does not look like an email address.',
  }
  return json({ error: friendly[data.code ?? ''] ?? data.message ?? 'That did not work. Check what you typed and try again.' }, response.status >= 500 ? 502 : 400)
}

/** GET: who is signed in. POST: sign up, sign in, or sign out. */
export async function handleAccount(request: Request, options: ApiOptions = {}): Promise<Response> {
  // Answer "are accounts available" without touching the database, so the page can hide the feature.
  if (request.method === 'GET' && !accountsConfigured()) return json({ accounts: false, user: null })
  const entered = await enter(request, ['GET', 'POST'], false)
  if (entered instanceof Response) return entered
  const { backend, caller } = entered
  if (request.method === 'GET') return json({ accounts: true, user: caller && { name: caller.name, email: caller.email } })

  const body = await readBody(request)
  if (body instanceof Response) return body
  if (body.action === 'sign-out') {
    return authResult(await backend.auth.api.signOut({ headers: request.headers, asResponse: true }), () => ({ user: null }))
  }
  // Creating accounts and guessing passwords are both worth slowing down.
  const refusal = await options.throttle?.(request)
  if (refusal) return fail(refusal === 'limited' ? 'Too many tries. Wait a minute, then try again.' : 'Accounts are unavailable right now. Try again in a moment.', refusal === 'limited' ? 429 : 503)
  const email = text(body.email, 254)?.trim().toLowerCase()
  const password = text(body.password, 128)
  if (!email || !password) return fail('Enter your email and password.', 400)
  const user = (data: { user?: { name?: string; email?: string } }) => ({ user: { name: data.user?.name ?? '', email: data.user?.email ?? email } })
  if (body.action === 'sign-in') {
    return authResult(await backend.auth.api.signInEmail({ body: { email, password }, headers: request.headers, asResponse: true }), user)
  }
  if (body.action === 'sign-up') {
    const name = text(body.name, 60)?.trim()
    if (!name) return fail('Enter a name for Pip to call you.', 400)
    return authResult(await backend.auth.api.signUpEmail({ body: { email, password, name }, headers: request.headers, asResponse: true }), user)
  }
  return fail('Unknown action.', 400)
}

const programRow = (row: { id: string; title: string; source: string; updated_at: Date }) => ({ id: row.id, title: row.title, source: row.source, updatedAt: row.updated_at.toISOString() })

/** The signed-in student's saved example programs. GET lists, POST adds, PUT ?id= replaces, DELETE ?id= removes. */
export async function handlePrograms(request: Request): Promise<Response> {
  const entered = await enter(request, ['GET', 'POST', 'PUT', 'DELETE'], true)
  if (entered instanceof Response) return entered
  const { pool } = entered.backend
  const userId = entered.caller!.userId
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  if (request.method === 'GET') {
    const { rows } = await pool.query('SELECT id, title, source, updated_at FROM saved_program WHERE user_id = $1 ORDER BY updated_at DESC, title', [userId])
    return json({ programs: rows.map(programRow) })
  }
  if (request.method === 'DELETE') {
    if (!isId) return fail('Which program?', 400)
    // user_id in every statement: one student can never touch another's programs.
    const { rowCount } = await pool.query('DELETE FROM saved_program WHERE id = $1 AND user_id = $2', [id, userId])
    return rowCount ? json({ deleted: id }) : fail('That program was not found.', 404)
  }
  const body = await readBody(request)
  if (body instanceof Response) return body
  const title = text(body.title, MAX_TITLE)?.trim()
  const source = text(body.source, MAX_SOURCE)
  if (!title) return fail(`Give the program a name of up to ${MAX_TITLE} characters.`, 400)
  if (source === null || !source.trim()) return fail('There is no program to save, or it is too long.', 400)
  if (request.method === 'PUT') {
    if (!isId) return fail('Which program?', 400)
    const { rows } = await pool.query('UPDATE saved_program SET title = $1, source = $2, updated_at = now() WHERE id = $3 AND user_id = $4 RETURNING id, title, source, updated_at', [title, source, id, userId])
    return rows[0] ? json({ program: programRow(rows[0]) }) : fail('That program was not found.', 404)
  }
  const { rows: [{ count }] } = await pool.query('SELECT count(*)::int AS count FROM saved_program WHERE user_id = $1', [userId])
  if (count >= MAX_PROGRAMS) return fail(`You can keep ${MAX_PROGRAMS} programs. Delete one to save another.`, 409)
  const { rows } = await pool.query('INSERT INTO saved_program (id, user_id, title, source) VALUES ($1, $2, $3, $4) RETURNING id, title, source, updated_at', [randomUUID(), userId, title, source])
  return json({ program: programRow(rows[0]) }, 201)
}

/** Lesson progress. GET lists finished lessons; PUT adds to them (progress is never taken away). */
export async function handleProgress(request: Request): Promise<Response> {
  const entered = await enter(request, ['GET', 'PUT'], true)
  if (entered instanceof Response) return entered
  const { pool } = entered.backend
  const userId = entered.caller!.userId
  if (request.method === 'PUT') {
    const body = await readBody(request)
    if (body instanceof Response) return body
    const known = new Set(lessons.map(lesson => lesson.id))
    const finished = Array.isArray(body.completed) ? [...new Set(body.completed.filter((id): id is string => typeof id === 'string' && known.has(id)))] : []
    if (finished.length) {
      await pool.query('INSERT INTO lesson_progress (user_id, lesson_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [userId, finished])
    }
  }
  const { rows } = await pool.query('SELECT lesson_id FROM lesson_progress WHERE user_id = $1', [userId])
  const done = new Set(rows.map(row => row.lesson_id as string))
  return json({ completed: lessons.map(lesson => lesson.id).filter(id => done.has(id)) })
}

export const routes: Record<string, (request: Request, options?: ApiOptions) => Promise<Response>> = {
  '/api/account': handleAccount,
  '/api/programs': handlePrograms,
  '/api/progress': handleProgress,
}
