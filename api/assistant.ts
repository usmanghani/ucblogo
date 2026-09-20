import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { handleAssistant } from '../server/assistant.js'

// Use Vercel's Node handler contract; its request body may already be parsed.
export default async function assistant(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  try {
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    const protocol = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https'
    const body = req.body === undefined ? Readable.toWeb(req) : typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const request = new Request(`${protocol}://${req.headers.host}${req.url}`, {
      method: req.method, headers, signal: controller.signal,
      ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body, duplex: 'half' } : {}),
    } as RequestInit)
    const response = await handleAssistant(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      if (res.destroyed) break
      res.write(chunk)
    }
    res.end()
  } catch {
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Pip is unavailable. Please try again.' })) }
    else res.end()
  }
}
