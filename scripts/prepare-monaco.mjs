import { cp, mkdir, readFile } from 'node:fs/promises'

const { version } = JSON.parse(await readFile(new URL('../node_modules/monaco-editor/package.json', import.meta.url), 'utf8'))
const target = new URL(`../public/monaco/${version}/vs/`, import.meta.url)
await mkdir(target, { recursive: true })
await cp(new URL('../node_modules/monaco-editor/min/vs/', import.meta.url), target, { recursive: true })
console.log(`Prepared local Monaco ${version} assets and workers`)
