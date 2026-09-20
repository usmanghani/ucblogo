import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { assistantDev } from './server/dev.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), assistantDev(process.env.OPENROUTER_API_KEY || loadEnv(mode, process.cwd(), '').OPENROUTER_API_KEY)],
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
}))
