# Accounts, saved programs and progress

Signing in is optional. Everything in Logo Teacher works anonymously; an account only changes where a student's work is kept.

| | Anonymous | Signed in |
| --- | --- | --- |
| Saved example programs | This browser (`localStorage`), up to 50 | The student's account, up to 100 |
| Lesson progress | This browser | The student's account |
| Follows the student to another computer | No | Yes |

**Saving a program.** *My programs* in the Code pane saves whatever is in the code pane under a name. Saved programs appear there and in the Examples menu, above the built-in examples.

**Signing up or in.** Work done anonymously is not lost: the browser's saved programs and finished lessons are added to the account, then removed from the browser. From then on the account is the record.

**Signing out.** The browser's copy of lesson progress is cleared, so the next student at a shared computer starts fresh. Their own anonymous saves, made after signing out, stay in the browser as before.

## Turn accounts on

Accounts need a Postgres database and a secret. Without both, the site runs in anonymous-only mode and never shows a sign-in button.

1. In the Vercel project, open **Storage** and add **Neon** (Postgres) from the Marketplace. Connect it to Production and Preview. This sets `DATABASE_URL`.
2. Add an environment variable `BETTER_AUTH_SECRET` with a long random value, for Production and Preview:

   ```bash
   openssl rand -base64 32
   ```

3. Redeploy.

There is no migration step. On its first request each server instance creates any missing tables: Better Auth's `user`, `session`, `account` and `verification`, and this app's `saved_program` and `lesson_progress`. Both steps only add what is missing.

Preview deployments share whichever database their `DATABASE_URL` points at. Give Preview its own Neon branch if you do not want test accounts next to real ones.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres connection string |
| `BETTER_AUTH_SECRET` | Signs session cookies. Changing it signs everyone out |
| `BETTER_AUTH_URL` | Optional. The site's public URL, if it differs from the URL requests arrive on |
| `DATABASE_POOL_MAX` | Optional. Connections per server instance, default 3 |

## How it works

- **Sign-in** is email and password through [Better Auth](https://www.better-auth.com), running inside this app with the same database. Passwords are hashed by Better Auth; sessions are an `HttpOnly` cookie that lasts 30 days. There is no email verification and no password reset, because the app sends no email. Add Better Auth's email features if you need them.
- **The API** is three Vercel functions in `api/`, thin wrappers over `server/api.ts`: `/api/account` (who am I, sign up, sign in, sign out), `/api/programs` and `/api/progress`. `vite` and `vite preview` serve the same handlers through the plugin in `server/dev.ts`.
- **Ownership.** Every SQL statement on a saved program or progress row includes the signed-in user's id, so one student cannot read, change or delete another's.
- **Other sites.** Writes are refused unless they come from this site's own pages, the same check Pip uses.
- **Guessing and bulk sign-ups.** Sign-in and sign-up attempts are counted against the per-visitor Firewall rule that meters Pip (`pip-assistant-ip`, see [pip.md](pip.md)).
- **Pip does not know who you are.** The account is not sent to the model. Pip still receives lesson progress with each message, as it does for anonymous students.

## Run it locally

Accounts are off in `npm run dev` unless you provide a database. The quickest way is the in-process Postgres the tests use:

```bash
npm run dev:db
```

Then, in `.env.local`:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
DATABASE_POOL_MAX=1
BETTER_AUTH_SECRET=local-development-only-change-me-please
```

and start `npm run dev` in another terminal. The data lasts until you stop `dev:db`; set `PGLITE_DIR` to a folder to keep it.

## Tests

`tests/account-api.test.ts` runs the real handlers, Better Auth and SQL against an in-process Postgres: sign-up, sign-in, sign-out, plain-language errors, cross-site refusal, saving and deleting programs, one student being unable to reach another's, validation and limits, progress merging, and anonymous-only mode.

`e2e/account.spec.ts` drives the page: an anonymous save that survives a reload, sign-up moving anonymous programs and progress into the account, the same account in a second browser, and sign-out leaving nothing behind. One test also runs against a deployment and checks that `/api/account` is routed and answers as JSON.
