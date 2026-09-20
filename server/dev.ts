import { Readable } from 'node:stream'
import type { Plugin, Connect } from 'vite'
import { handleAssistant } from './assistant.ts'
export function assistantDev(key?: string): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/assistant') { next(); return }
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    void (async () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      const init = { method: req.method, headers, signal: controller.signal, duplex: 'half', ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Readable.toWeb(req) } : {}) }
      const request = new Request(`http://${req.headers.host}${req.url}`, init as RequestInit)
      const response = await handleAssistant(request, key)
      res.writeHead(response.status, Object.fromEntries(response.headers))
      if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) { if (res.destroyed) break; res.write(chunk) }
      res.end()
    })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end('Pip is unavailable.') })
  }
  return { name: 'pip-server', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}
