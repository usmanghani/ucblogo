import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromThreadMessageLike } from '@assistant-ui/react'
import {
  clearPipChatSession,
  createPipChatModelAdapter,
  createPipHistoryAdapter,
  PIP_CHAT_STORAGE_KEY,
  toPipMessages,
  type PipRuntimeContext,
} from '../src/assistant/runtime'
import type { Workspace } from '../src/assistant/agent'

const complete = { type: 'complete', reason: 'stop' } as const
const user = (id: string, content: string) => fromThreadMessageLike({ role: 'user', content }, id, complete)
const assistant = (id: string, content: string) => fromThreadMessageLike({ role: 'assistant', content }, id, complete)

afterEach(() => vi.unstubAllGlobals())

describe('Pip assistant-ui runtime', () => {
  it('persists chat messages to browser session storage and restores them after a refresh', async () => {
    sessionStorage.clear()
    const first = createPipHistoryAdapter(sessionStorage)
    await first.load()
    await first.append({ parentId: null, message: user('user-1', 'Draw a cat') })
    await first.append({ parentId: 'user-1', message: assistant('assistant-1', 'I will draw a cat.') })

    const restored = await createPipHistoryAdapter(sessionStorage).load()
    expect(restored.headId).toBe('assistant-1')
    expect(restored.messages.map(item => item.message.content[0])).toEqual([
      { type: 'text', text: 'Draw a cat' },
      { type: 'text', text: 'I will draw a cat.' },
    ])
    expect(sessionStorage.getItem(PIP_CHAT_STORAGE_KEY)).toContain('assistant-1')
  })

  it('migrates existing Pip conversation text and ignores non-message tool entries', async () => {
    sessionStorage.clear()
    sessionStorage.setItem('ucblogo.pip.chat.v1', JSON.stringify({
      messages: [],
      entries: [
        { kind: 'user', text: 'Draw a rocket' },
        { kind: 'tool', text: 'Run program', result: '{"success":true}' },
        { kind: 'assistant', text: 'The rocket is ready.' },
      ],
    }))

    const migrated = await createPipHistoryAdapter(sessionStorage).load()
    expect(migrated.messages.map(item => [item.message.role, item.message.content[0]])).toEqual([
      ['user', { type: 'text', text: 'Draw a rocket' }],
      ['assistant', { type: 'text', text: 'The rocket is ready.' }],
    ])
  })

  it('clears both the current chat and its legacy browser session', async () => {
    sessionStorage.setItem(PIP_CHAT_STORAGE_KEY, '{"messages":[]}')
    sessionStorage.setItem('ucblogo.pip.chat.v1', '{"entries":[]}')
    clearPipChatSession(sessionStorage)
    expect(sessionStorage.getItem(PIP_CHAT_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem('ucblogo.pip.chat.v1')).toBeNull()
  })

  it('keeps only text turns when sending assistant-ui history to the Logo agent', () => {
    const messages = [
      user('user-1', 'Draw a ball'),
      fromThreadMessageLike({
        role: 'assistant',
        content: [
          { type: 'text', text: 'I am drawing it.' },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'run_program', args: {}, argsText: '{}', result: { success: true } },
        ],
      }, 'assistant-1', complete),
      user('user-2', 'Make it blue'),
    ]
    expect(toPipMessages(messages).map(message => [message.role, message.content])).toEqual([
      ['user', 'Draw a ball'],
      ['assistant', 'I am drawing it.'],
      ['user', 'Make it blue'],
    ])
  })

  it('streams a complete turn through the existing API and always releases the busy state', async () => {
    const fetcher = vi.fn(async () => new Response(
      `data: ${JSON.stringify({ model: 'deepseek/deepseek-v4.1-flash', choices: [{ delta: { content: 'A blue ball is ready.' } }] })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    ))
    vi.stubGlobal('fetch', fetcher)
    const writes: string[] = []
    const statuses: string[] = []
    const busy: boolean[] = []
    const workspace: Workspace = { read: () => 'CS', write: code => writes.push(code), run: async () => ({ success: true }) }
    const context: PipRuntimeContext = {
      workspace,
      consent: true,
      onBusy: value => busy.push(value),
      onStatus: value => statuses.push(value),
      onCheckpoint: vi.fn(),
    }
    const model = createPipChatModelAdapter(() => context)
    const options = {
      messages: [user('user-1', 'Draw a blue ball')],
      abortSignal: new AbortController().signal,
      context: {},
      runConfig: {},
      unstable_getMessage: () => assistant('assistant-1', ''),
    }
    const updates = []
    for await (const update of model.run(options as never)) updates.push(update)

    const request = JSON.parse(fetcher.mock.calls[0][1]?.body as string)
    expect(fetcher.mock.calls[0][0]).toBe('/api/assistant')
    expect(request).not.toHaveProperty('model')
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Draw a blue ball' })
    expect(request.consent).toBe(true)
    expect(updates.at(-1)?.content).toEqual([{ type: 'text', text: 'A blue ball is ready.' }])
    expect(statuses.at(-1)).toBe('Turn complete')
    expect(busy).toEqual([true, false])
  })
})
