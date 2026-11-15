import pg from 'pg'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'

/**
 * Accounts are optional. They are on when the deployment has a Postgres database
 * (Neon sets DATABASE_URL) and a secret for signing session cookies.
 */
export function accountsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.DATABASE_URL || env.POSTGRES_URL) && env.BETTER_AUTH_SECRET)
}

const OWN_TABLES = `
  CREATE TABLE IF NOT EXISTS saved_program (
    id uuid PRIMARY KEY,
    user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    title text NOT NULL,
    source text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS saved_program_user ON saved_program (user_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    lesson_id text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
  );
`

export interface Backend {
  pool: pg.Pool
  auth: ReturnType<typeof betterAuth>
}

let backend: Promise<Backend> | undefined

/** Connect, bring the schema up to date, and build the auth instance. Once per server instance. */
export function getBackend(origin: string): Promise<Backend> {
  if (backend) return backend
  const starting = (async (): Promise<Backend> => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      max: Number(process.env.DATABASE_POOL_MAX) || 3,
    })
    const options: BetterAuthOptions = {
      database: pool,
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL || origin,
      emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
      // Stay signed in for a month, the length of a school term's worth of visits.
      session: { expiresIn: 60 * 60 * 24 * 30 },
    }
    // Both steps only add what is missing, so every cold start can run them safely.
    const { runMigrations } = await getMigrations(options)
    await runMigrations()
    await pool.query(OWN_TABLES)
    return { pool, auth: betterAuth(options) }
  })()
  backend = starting
  // A failed start (database briefly unreachable) must not poison the instance.
  starting.catch(() => { if (backend === starting) backend = undefined })
  return starting
}

/** For tests: drop the cached connection so the next call reads the environment again. */
export async function resetBackend(): Promise<void> {
  const current = backend
  backend = undefined
  if (current) await current.then(({ pool }) => pool.end()).catch(() => {})
}
