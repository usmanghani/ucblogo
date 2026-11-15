// A scripted stand-in for the language model, speaking the OpenAI Chat Completions
// streaming protocol. The browser tests point the agent at it (PIP_MODEL_BASE_URL) so the
// real page, agent loop, tools and Logo engine are exercised without credentials or cost.
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export const SQUARE = 'CS\nSETPC 4\nSETPENSIZE 3\nREPEAT 4 [FD 80 RT 90]\nHT\nPRINT [SQUARE READY]'
const BROKEN = 'CS\nREPEAT 4 [FDD 80 RT 90]'
export const HOUSE = 'TO house\n  REPEAT 4 [FD 100 RT 90]\nEND\nTO roof\n  FD 100 RT 30\n  REPEAT 3 [FD 100 RT 120]\nEND\n\nCS\nhouse\nroof\nHT\nPRINT [HOUSE FROM YOUR DRAWING]'
const REPAIRED = 'CS\nREPEAT 4 [FD 80 RT 90]\nPRINT [REPAIRED]'

const hasPicture = message => Array.isArray(message?.content) && message.content.some(part => part.type === 'image_url' && String(part.image_url?.url).startsWith('data:image/'))

const textOf = message => typeof message?.content === 'string'
  ? message.content
  : Array.isArray(message?.content) ? message.content.map(part => part.text ?? '').join('\n') : ''

/** Decide the next assistant step from the conversation so far. */
export function script(messages) {
  const last = messages.at(-1)
  const users = messages.filter(message => message.role === 'user').map(textOf)
  // Page context arrives as user-role messages too, so match on the most recent student text.
  const asked = [...users].reverse().find(text => !text.includes('<program>') && !/^(Client context:|The student's code pane|The last run|The program has not been run|Open lesson|No lesson is open)/.test(text.trim())) ?? ''
  const context = users.join('\n')
  if (last?.role === 'tool') {
    const result = textOf(last)
    if (result.includes('HOUSE FROM YOUR DRAWING')) return { text: 'I see a house: a square with a triangle roof. Here is the turtle’s version of it.' }
    if (result.includes('FDD')) return { tool: 'write_program', args: { code: REPAIRED } }
    if (result.includes('"completed"')) return { text: 'Lesson complete! You drew a square all by yourself.' }
    if (result.includes('REPAIRED')) return { text: 'I fixed my spelling mistake: `FDD` should be `FD`.' }
    return { text: 'Your red square is ready. Each side is 80 turtle steps.' }
  }
  if (/turn it into a Logo program|my drawing/i.test(asked)) {
    return messages.some(hasPicture) ? { tool: 'write_program', args: { code: HOUSE } } : { text: 'I do not see a picture. Try attaching it again.' }
  }
  if (/slow/i.test(asked)) return { text: 'This slow answer should never arrive.', delayMs: 4000 }
  if (/broken/i.test(asked)) return { tool: 'write_program', args: { code: BROKEN } }
  if (/square/i.test(asked)) return { tool: 'write_program', args: { code: SQUARE } }
  if (/finished the challenge/i.test(asked)) return { tool: 'complete_lesson', args: { lesson_id: 'meet-the-turtle' } }
  if (/what is in my editor/i.test(asked)) return { text: context.includes('MY SECRET MARKER') ? 'I can see MY SECRET MARKER in your code pane.' : 'I cannot see your program.' }
  if (/what went wrong/i.test(asked)) return { text: /I don't know how to/i.test(context) ? "The turtle did not know one of your words. Check the spelling." : 'Your last run looks fine to me.' }
  if (/lesson/i.test(asked)) return { text: 'Welcome to the lesson! Try this:\n\n```logo\nCS\nFD 100\nRT 90\nFD 100\n```\n\nWhat do you think the turtle will draw?' }
  return { text: 'Hello! I am Pip. Ask me to draw a square.' }
}

const chunk = (delta, finish_reason = null) => `data: ${JSON.stringify({ id: 'chatcmpl-fake', object: 'chat.completion.chunk', created: 0, model: 'fake/pip', choices: [{ index: 0, delta, finish_reason }] })}\n\n`

export function startFakeModel(port = 4319) {
  const requests = []
  const server = createServer(async (req, res) => {
    if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(requests)); return }
    let raw = ''
    for await (const part of req) raw += part
    const body = JSON.parse(raw || '{}')
    requests.push(body)
    const step = script(body.messages ?? [])
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
    if (step.delayMs) await new Promise(resolve => setTimeout(resolve, step.delayMs))
    if (res.destroyed) return
    if (step.tool) {
      res.write(chunk({ role: 'assistant', content: null, tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: { name: step.tool, arguments: JSON.stringify(step.args) } }] }))
      res.write(chunk({}, 'tool_calls'))
    } else {
      // Split the text so the page's streaming path is exercised, not just a single frame.
      const words = step.text.match(/\S+\s*/g) ?? [step.text]
      for (const word of words) res.write(chunk({ role: 'assistant', content: word }))
      res.write(chunk({}, 'stop'))
    }
    res.write(`data: ${JSON.stringify({ id: 'chatcmpl-fake', object: 'chat.completion.chunk', created: 0, model: 'fake/pip', choices: [], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } })}\n\n`)
    res.end('data: [DONE]\n\n')
  })
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FAKE_MODEL_PORT || 4319)
  await startFakeModel(port)
  console.log(`Scripted model listening on http://127.0.0.1:${port}/v1`)
}
