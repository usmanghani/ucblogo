import './prepare-monaco.mjs'
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const sha = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Cannot identify the deployment commit')
await writeFile(new URL('../public/deployment.json', import.meta.url), JSON.stringify({ sha }) + '\n')
