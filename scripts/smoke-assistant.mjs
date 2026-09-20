import { pathToFileURL } from 'node:url'

// Validate an actual complete SSE response. A 200 HTML fallback, truncated stream,
// provider error event, or missing server credentials must fail the release check.
export async function verifyAssistantStream(response) {
  if (!response.ok) throw new Error(`Assistant smoke test returned HTTP ${response.status}; check server credentials, quota rules, provider availability, and preview protection.`)
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new Error('Assistant did not return an SSE stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', received = false, finished = false, bytes = 0
  function event(frame) {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data) return
    if (data === '[DONE]') { finished = true; return }
    let chunk
    try { chunk = JSON.parse(data) } catch { throw new Error('Malformed assistant SSE data') }
    if (chunk.error || chunk.choices?.some(choice => choice.finish_reason === 'error')) throw new Error('Provider reported an error inside the assistant stream')
    if (chunk.choices?.some(choice => choice.delta?.content?.trim() || choice.delta?.tool_calls?.some(call => call.function?.name))) received = true
  }
  try {
    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 256_000) throw new Error('Assistant smoke response exceeded its size limit')
      buffer += decoder.decode(value, { stream: true })
      // Normalize complete CRLF sequences, including boundaries split across chunks.
      buffer = buffer.replaceAll('\r\n', '\n')
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        event(frame)
      }
    }
  } finally { await reader.cancel().catch(() => {}) }
  if (!finished || !received) throw new Error('Assistant stream ended without model output and a completion marker')
}

export async function smokeAssistant({ baseURL, secret = '', fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required; live testing cannot be skipped')
  const url = new URL(baseURL)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.port) throw new Error('Live smoke tests require an HTTPS Vercel deployment URL')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetcher(new URL('/api/assistant', url.origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(100_000),
      headers: { 'Content-Type': 'application/json', Origin: url.origin, ...(secret ? { 'x-vercel-protection-bypass': secret } : {}) },
      // Synthetic content only. Never send repository programs or user conversations.
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with a short greeting. Do not read, write, or run a program.' }], program: '', consent: true }),
    })
    if ([429, 502, 504].includes(response.status) && attempt < 3) {
      await response.body?.cancel()
      log(`Assistant returned HTTP ${response.status}; retrying transient failure (${attempt}/3)`)
      await sleep(30_000)
      continue
    }
    await verifyAssistantStream(response)
    log('Live assistant smoke passed: deployed route, credentials, quota checks, and complete model stream')
    return
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await smokeAssistant({ baseURL: process.env.PLAYWRIGHT_BASE_URL, secret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
}
