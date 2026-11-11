import type { Connect, Plugin } from 'vite'
import { routes } from './api.ts'
import { serve } from './node.ts'

/** Serve /api/* from `vite` and `vite preview`, the way Vercel functions serve them when deployed. */
export function accountApi(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const handler = routes[req.url?.split('?')[0] ?? '']
    if (!handler) { next(); return }
    void serve(handler, req, res)
  }
  return {
    name: 'logo-teacher-account-api',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
