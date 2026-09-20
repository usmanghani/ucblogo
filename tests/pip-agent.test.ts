import { describe, expect, it, vi } from 'vitest'
import { readCompletion, runAgent, type Workspace } from '../src/assistant/agent'
import type { Message } from '../src/assistant/protocol'

function sse(delta: object, done = true) {
  return new Response(`data: ${JSON.stringify({ model: 'test/free', choices: [{ delta }] })}\n\n${done ? 'data: [DONE]\n\n' : ''}`, { headers: { 'Content-Type': 'text/event-stream' } })
}
const call = (name: string, args = '{}') => ({ tool_calls: [{ index: 0, id: 'call1', type: 'function', function: { name, arguments: args } }] })
const initial: Message[] = [{ role: 'user', content: 'Draw a square' }]
function workspace() {
  let code = 'PRINT 1'
  return { read: () => code, write: vi.fn((s: string) => { code = s }), run: vi.fn(async () => ({ success: true, errors: [] })) } satisfies Workspace
}

describe('Pip agent', () => {
  it('writes, runs, sends tool results back, then answers', async () => {
    const w = workspace()
    const responses = [sse(call('read_program')), sse(call('write_program', JSON.stringify({ code: 'CS REPEAT 4 [FD 80 RT 90] HT' }))), sse(call('run_program')), sse({ content: 'Your square is ready.' })]
    const fetcher = vi.fn(async () => responses.shift()!)
    const history = await runAgent(initial, w, new AbortController().signal, vi.fn(), fetcher)
    expect(w.write).toHaveBeenCalledWith('CS REPEAT 4 [FD 80 RT 90] HT')
    expect(w.run).toHaveBeenCalledOnce()
    expect(history.filter(m => m.role === 'tool')).toHaveLength(3)
    expect(history.at(-1)?.content).toBe('Your square is ready.')
  })
  it('repairs failed execution in a subsequent tool step', async () => {
    const w = workspace(); w.run.mockResolvedValueOnce({ success: false, errors: ['Unknown command'] } as never)
    const responses = [sse(call('run_program')), sse(call('write_program', '{"code":"PRINT 42"}')), sse(call('run_program')), sse({ content: 'Fixed.' })]
    const history = await runAgent(initial, w, new AbortController().signal, vi.fn(), vi.fn(async () => responses.shift()!))
    expect(w.run).toHaveBeenCalledTimes(2)
    expect(history.some(m => m.content?.includes('Unknown command'))).toBe(true)
  })
  it('does not overwrite edits made while waiting for the model', async () => {
    const w = workspace()
    let round = 0
    const result = await runAgent(initial, w, new AbortController().signal, vi.fn(), vi.fn(async () => {
      if (round++ === 0) { w.write('PRINT 999'); return sse(call('write_program', '{"code":"PRINT 2"}')) }
      return sse({ content: 'Please review your edit.' })
    }))
    expect(w.read()).toBe('PRINT 999')
    expect(result.some(m => m.content?.includes('user edited'))).toBe(true)
  })
  it.each(['{"code":""}', '{"code":4}', 'invalid', 'null'])('reports malformed write arguments: %s', async args => {
    const w = workspace(); const responses = [sse(call('write_program', args)), sse({ content: 'Sorry.' })]
    const h = await runAgent(initial, w, new AbortController().signal, vi.fn(), vi.fn(async () => responses.shift()!))
    expect(w.write).not.toHaveBeenCalled(); expect(h[2].content).toContain('error')
  })
  it('rejects unknown tools without side effects', async () => {
    const w = workspace(); const responses = [sse(call('shell')), sse({ content: 'Done' })]
    const h = await runAgent(initial, w, new AbortController().signal, vi.fn(), vi.fn(async () => responses.shift()!))
    expect(h[2].content).toContain('Unknown tool'); expect(w.run).not.toHaveBeenCalled()
  })
  it('stops before any tool effect after cancellation', async () => {
    const w = workspace(), aborter = new AbortController()
    await expect(runAgent(initial, w, aborter.signal, vi.fn(), vi.fn(async () => { aborter.abort(); return sse(call('write_program', '{"code":"PRINT 5"}')) }))).rejects.toThrow()
    expect(w.write).not.toHaveBeenCalled()
  })
  it('bounds autonomous turns', async () => {
    await expect(runAgent(initial, workspace(), new AbortController().signal, vi.fn(), vi.fn(async () => sse(call('read_program'))))).rejects.toThrow('8-step limit')
  })
  it('never executes a partial streamed tool call', async () => {
    const w = workspace()
    await expect(runAgent(initial, w, new AbortController().signal, vi.fn(), vi.fn(async () => sse(call('write_program', '{"code":"PRINT 5"}'), false)))).rejects.toThrow('Connection interrupted')
    expect(w.write).not.toHaveBeenCalled()
  })
  it('handles arbitrarily fragmented SSE and UTF-8 text', async () => {
    const raw = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"café"}}]}\r\n\r\ndata: [DONE]\r\n\r\n')
    const stream = new ReadableStream({ start(c) { for (const byte of raw) c.enqueue(new Uint8Array([byte])); c.close() } })
    expect((await readCompletion(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }), vi.fn())).content).toBe('café')
  })
  it('surfaces provider errors and limits without executing tools', async () => {
    await expect(readCompletion(new Response('{"error":"Free models are busy"}', { status: 429 }), vi.fn())).rejects.toThrow('busy')
    await expect(readCompletion(new Response('data: {"choices":[{"finish_reason":"length"}]}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }), vi.fn())).rejects.toThrow('response limit')
  })
})
