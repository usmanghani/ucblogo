import react from '@vitejs/plugin-react'
import { eveVite } from 'eve/vite'
import { defineConfig } from 'vite'

// eveVite runs Pip (the eve agent in ./agent) beside the page in `vite` and `vite preview`
// and proxies /eve/v1/* to it, so the browser only ever talks to one origin.
export default defineConfig({
  plugins: [react(), eveVite()],
})
