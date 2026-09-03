import { defineConfig } from 'vite'

/**
 * Bundles the command-line interface (src/cli/bin.ts) into dist/cli/ucblogo.mjs.
 *   npm run build:cli && node dist/cli/ucblogo.mjs program.lgo
 */
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'src/cli/bin.ts',
    outDir: 'dist/cli',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: { entryFileNames: 'ucblogo.mjs', format: 'es'},
    },
  },
  ssr: { noExternal: true, target: 'node' },
})
