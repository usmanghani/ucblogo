// An in-process Postgres for the browser tests and for local development without Neon.
// It speaks the real wire protocol, so the app connects to it exactly as it does to Neon.
// Data lives in memory unless PGLITE_DIR names a folder to keep it in.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { createServer } from 'node:http'

const port = Number(process.env.TEST_DB_PORT || 54329)
const db = await PGlite.create(process.env.PGLITE_DIR || undefined)
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
// A plain HTTP port next to it, so a test runner can tell when the database is up.
createServer((_req, res) => res.end('ready')).listen(port + 1, '127.0.0.1')
console.log(`Test database listening on postgres://postgres:postgres@127.0.0.1:${port}/postgres`)
