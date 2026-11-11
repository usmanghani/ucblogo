import react from '@vitejs/plugin-react'
import { eveVite } from 'eve/vite'
import { defineConfig, loadEnv } from 'vite'
import { accountApi } from './server/dev.ts'

// eveVite runs Pip (the eve agent in ./agent) beside the page in `vite` and `vite preview`
// and proxies /eve/v1/* to it, so the browser only ever talks to one origin.
// accountApi serves /api/* (accounts, saved programs, progress) the way Vercel functions do when deployed.
export default defineConfig(({ mode }) => {
  // The account API reads DATABASE_URL and BETTER_AUTH_SECRET from the server environment;
  // in development that includes .env.local. Nothing here reaches the browser bundle.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[name] ??= value
  return { plugins: [react(), eveVite(), accountApi()] }
})
