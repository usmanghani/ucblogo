import { MAX_PROGRAM, type Message, type ToolCall } from './protocol'

export interface Workspace {
  read: () => string
  write: (code: string) => void
  run: (signal: AbortSignal) => Promise<unknown>
}
export interface AgentEvent {
  type: 'text' | 'tool' | 'result' | 'model' | 'status'
  text: string
  id?: string
}

// SSE chunks may split anywhere, including within a UTF-8 character or a tool argument.
export async function readCompletion(response: Response, emit: (event: AgentEvent) => void): Promise<Message> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Pip could not connect (${response.status}).`)
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Pip’s server is unavailable. Check the server configuration.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', content = '', finished = false, size = 0
  const calls = new Map<number, ToolCall>()
  function parseFrame(frame: string) {
    const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!payload) return
    if (payload.trim() === '[DONE]') { finished = true; return }
    const data = JSON.parse(payload)
    if (data.error) throw new Error('The free model interrupted this turn. Please try again.')
    if (data.model) emit({ type: 'model', text: data.model })
    const choice = data.choices?.[0]
    if (choice?.finish_reason === 'length') throw new Error('The model reached its response limit. Ask for a smaller program.')
    const delta = choice?.delta
    if (typeof delta?.content === 'string') { content += delta.content; emit({ type: 'text', text: delta.content }) }
    for (const part of delta?.tool_calls ?? []) {
      if (!Number.isInteger(part.index) || part.index < 0 || part.index > 7) throw new Error('Invalid tool response.')
      const call = calls.get(part.index) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      if (part.id) call.id += part.id
      if (part.function?.name) call.function.name += part.function.name
      if (part.function?.arguments) call.function.arguments += part.function.arguments
      calls.set(part.index, call)
    }
  }
  try {
    while (!finished) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 300000) throw new Error('Model response is too large.')
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        parseFrame(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2)
      }
    }
    if (!finished) throw new Error('Connection interrupted. No incomplete tool calls were applied. Try again.')
    const tool_calls = [...calls.values()]
    if (tool_calls.some(c => !c.id || !c.function.name) || new Set(tool_calls.map(c => c.id)).size !== tool_calls.length) throw new Error('Invalid tool response.')
    if (!content && !tool_calls.length) throw new Error('The free model returned an empty response. Try again.')
    return { role: 'assistant', content: content || null, ...(tool_calls.length ? { tool_calls } : {}) }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

export async function runAgent(messages: Message[], workspace: Workspace, signal: AbortSignal, emit: (event: AgentEvent) => void, fetcher: typeof fetch = fetch): Promise<Message[]> {
  const history = [...messages]
  let expectedProgram = workspace.read()
  for (let step = 0; step < 8; step++) {
    signal.throwIfAborted()
    emit({ type: 'status', text: step ? 'Pip is checking the results…' : 'Pip is thinking…' })
    const response = await fetcher('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, program: workspace.read() }), signal })
    const assistant = await readCompletion(response, emit)
    signal.throwIfAborted()
    history.push(assistant)
    if (!assistant.tool_calls?.length) return history
    for (const call of assistant.tool_calls) {
      signal.throwIfAborted()
      emit({ type: 'tool', id: call.id, text: call.function.name })
      let result: unknown
      try {
        const args = JSON.parse(call.function.arguments || '{}')
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid tool arguments.')
        if (call.function.name === 'read_program') {
          expectedProgram = workspace.read()
          result = { code: expectedProgram, workspace: 'text', execution: 'Fresh interpreter, no files or hardware; 3 second time limit.' }
        } else if (call.function.name === 'write_program') {
          if (typeof args.code !== 'string' || !args.code.trim() || args.code.length > MAX_PROGRAM) throw new Error('Program must be nonempty and under 30,000 characters.')
          if (workspace.read() !== expectedProgram) throw new Error('The user edited the program during this turn. Read it again before making changes.')
          workspace.write(args.code); expectedProgram = args.code
          result = { written: true, characters: args.code.length }
        } else if (call.function.name === 'run_program') {
          if (workspace.read() !== expectedProgram) throw new Error('The user changed the program. Read it again before running.')
          emit({ type: 'status', text: 'Pip is running the program…' })
          result = await workspace.run(signal)
        } else throw new Error('Unknown tool. Only Logo workspace tools are available.')
      } catch (error) {
        signal.throwIfAborted()
        result = { error: error instanceof Error ? error.message : String(error) }
      }
      const text = JSON.stringify(result)
      history.push({ role: 'tool', tool_call_id: call.id, content: text })
      emit({ type: 'result', id: call.id, text })
    }
  }
  throw new Error('Pip reached the 8-step limit. Your edits are saved; send a follow-up to continue.')
}
