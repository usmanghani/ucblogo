// One real turn against a deployed Logo Teacher: the page route, the agent service, its
// access checks and quota, AI Gateway credentials, and a complete model reply.
// It does not judge how good the teaching is.
import { pathToFileURL } from 'node:url'
import { drawingPng } from '../e2e/drawing-png.mjs'

/** Decide whether a finished turn's events show a working teacher. Throws with the reason if not. */
export function verifyTurn(events) {
  const settled = events.find(event => event.type === 'turn.settled')
  if (!settled) throw new Error('The turn never finished')
  const failure = events.find(event => event.type === 'model.settled' && event.data?.outcome === 'failed')
  if (failure) throw new Error(`The model call failed: ${failure.data?.error?.code ?? 'unknown'} ${failure.data?.error?.message ?? ''}`.trim())
  if (settled.data?.outcome !== 'completed') throw new Error(`The turn ended as "${settled.data?.outcome}"`)
  const reply = events.filter(event => event.type === 'content.completed' && event.data?.kind === 'text').map(event => event.data.value).join(' ').trim()
  if (!reply) throw new Error('Pip finished the turn without saying anything')
  const model = events.find(event => event.type === 'model.started')?.data?.modelId
  return { reply, model }
}

async function settle(delivery) {
  const events = []
  for await (const event of delivery.stream({ signal: AbortSignal.timeout(100_000) })) {
    events.push(event)
    if (event.type === 'turn.settled') break
  }
  return events
}

export async function smokeTeacher({ baseURL, secret = '', createClient, log = console.log, attempts = 3, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required; live testing cannot be skipped')
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.port) throw new Error('Live smoke tests require an HTTPS Vercel deployment URL')
  // The automation secret is only ever sent to the deployment under test.
  const headers = { origin: url.origin, ...(secret ? { 'x-vercel-protection-bypass': secret } : {}) }
  createClient ??= async options => new (await import('eve/client')).Client(options)
  const client = await createClient({ baseUrl: url.origin, headers })
  for (let attempt = 1; ; attempt++) {
    try {
      // Synthetic content only. Never send repository programs or user conversations.
      const page = { program: '', lastRun: null, lesson: null, completed: [] }
      const { session, delivery } = await client.sessions.create({ message: 'Say hello in one short sentence. Do not use any tools.', clientContext: page })
      const { model } = verifyTurn(await settle(delivery))
      // A second turn with a picture: proves uploads are accepted, stored and shown to the model.
      const picture = await session.send([
        { type: 'text', text: 'Name the shape in this picture in one short sentence. Do not use any tools.' },
        { type: 'file', mediaType: 'image/png', filename: 'drawing.png', data: `data:image/png;base64,${drawingPng(128).toString('base64')}` },
      ], { clientContext: page })
      const { reply } = verifyTurn(await settle(picture))
      if (!/square|rectangle|box/i.test(reply)) throw new Error(`Pip did not recognise the test drawing. It said: ${reply.slice(0, 200)}`)
      log(`Live teacher smoke passed: deployed agent route, access checks, quota, a complete reply from ${model ?? 'the model'}, and a picture it could see`)
      return
    } catch (error) {
      // Quota and upstream hiccups are worth a retry; a misconfiguration is not.
      const transient = [429, 502, 503, 504].includes(error?.status) || /helping a lot of students/.test(error?.message ?? '')
      if (!transient || attempt >= attempts) throw error
      log(`Teacher smoke attempt ${attempt} failed (${error?.status ?? error?.message}); retrying`)
      await sleep(30_000)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await smokeTeacher({ baseURL: process.env.PLAYWRIGHT_BASE_URL, secret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
}
