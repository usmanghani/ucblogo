import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ApiOptions } from './api.js'

type Handler = (request: Request, options?: ApiOptions) => Promise<Response>

/** Run a web-standard handler behind Node's (req, res), as Vercel functions and Vite's server call it. */
export async function serve(handler: Handler, req: IncomingMessage & { body?: unknown }, res: ServerResponse, options?: ApiOptions): Promise<void> {
  try {
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    const protocol = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? 'https' : 'http'
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    // Vercel may have parsed the body already.
    const body = !hasBody ? undefined : req.body === undefined ? Readable.toWeb(req) : typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const request = new Request(`${protocol}://${req.headers.host}${req.url}`, { method: req.method, headers, ...(hasBody ? { body, duplex: 'half' } : {}) } as RequestInit)
    const response = await handler(request, options)
    res.statusCode = response.status
    response.headers.forEach((value, name) => { if (name !== 'set-cookie') res.setHeader(name, value) })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('Set-Cookie', cookies)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error('API request failed', { reason: error instanceof Error ? error.name : 'unknown' })
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json') }
    res.end(JSON.stringify({ error: 'Something went wrong. Try again.' }))
  }
}
