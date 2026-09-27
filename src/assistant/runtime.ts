import {
  fromThreadMessageLike,
  type ChatModelAdapter,
  type ExportedMessageRepository,
  type ThreadAssistantMessagePart,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from '@assistant-ui/react'
import { runAgent, type AgentEvent, type Workspace } from './agent'
import type { Message } from './protocol'

export const PIP_CHAT_STORAGE_KEY = 'ucblogo.pip.chat.aui.v1'
const LEGACY_CHAT_STORAGE_KEY = 'ucblogo.pip.chat.v1'
const MAX_HISTORY_MESSAGES = 80
const MAX_HISTORY_CHARS = 180_000
const MAX_CONTEXT_MESSAGES = 20

export interface PipRuntimeContext {
  workspace: Workspace
  consent: boolean
  onBusy: (busy: boolean) => void
  onStatus: (status: string) => void
  onCheckpoint: (checkpoint: { before: string; after: string } | null) => void
}

export function toPipMessages(messages: readonly ThreadMessage[]): Message[] {
  const transcript: Message[] = []
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const content = message.content
      .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim()
    if (content) transcript.push({ role: message.role, content })
  }

  const recent = transcript.slice(-MAX_CONTEXT_MESSAGES)
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}

function eventQueue() {
  const values: AgentEvent[] = []
  let wake: (() => void) | undefined
  let closed = false
  let failure: unknown
  return {
    push(event: AgentEvent) {
      if (closed) return
      values.push(event)
      wake?.()
      wake = undefined
    },
    close(error?: unknown) {
      closed = true
      failure = error
      wake?.()
      wake = undefined
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<AgentEvent> {
      while (true) {
        if (values.length) {
          yield values.shift()!
          continue
        }
        if (closed) {
          if (failure) throw failure
          return
        }
        await new Promise<void>(resolve => { wake = resolve })
      }
    },
  }
}

function toolFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const value = result as { error?: unknown; errors?: unknown }
  return Boolean(value.error || (Array.isArray(value.errors) && value.errors.length))
}

export function createPipChatModelAdapter(getContext: () => PipRuntimeContext): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const context = getContext()
      if (!context.consent) throw new Error('Allow Pip to send prompts and program text to OpenRouter before sending.')

      const transcript = toPipMessages(messages)
      if (!transcript.length || transcript.at(-1)?.role !== 'user') {
        throw new Error('Pip could not read your latest message. Please send it again.')
      }

      context.onBusy(true)
      context.onCheckpoint(null)
      context.onStatus('Pip is thinking…')
      const before = context.workspace.read()
      let wroteProgram = false
      const workspace: Workspace = {
        read: () => context.workspace.read(),
        write: code => {
          context.workspace.write(code)
          wroteProgram = true
          context.onCheckpoint({ before, after: code })
        },
        run: signal => context.workspace.run(signal),
      }
      const queue = eventQueue()
      const run = runAgent(transcript, workspace, abortSignal, event => queue.push(event))
        .then(() => queue.close(), error => queue.close(error))
      let text = ''
      const toolCalls = new Map<string, Extract<ThreadAssistantMessagePart, { type: 'tool-call' }>>()

      try {
        for await (const event of queue) {
          if (event.type === 'status') {
            context.onStatus(event.text)
            continue
          }
          if (event.type === 'model') continue
          if (event.type === 'text') {
            text += event.text
          } else if (event.type === 'tool' && event.id) {
            toolCalls.set(event.id, {
              type: 'tool-call',
              toolCallId: event.id,
              toolName: event.text,
              args: {},
              argsText: '{}',
              isPreliminary: true,
            })
          } else if (event.type === 'result' && event.id) {
            const current = toolCalls.get(event.id)
            if (current) {
              let result: unknown
              try { result = JSON.parse(event.text) } catch { result = { error: 'Tool returned an invalid result.' } }
              toolCalls.set(event.id, {
                ...current,
                result,
                isError: toolFailed(result),
                isPreliminary: false,
              })
            }
          }

          const content: ThreadAssistantMessagePart[] = []
          if (text) content.push({ type: 'text', text })
          content.push(...toolCalls.values())
          if (content.length) yield { content }
        }
        await run
        context.onStatus('Turn complete')
      } catch (error) {
        if (abortSignal.aborted) {
          context.onStatus('Turn stopped. Any completed edits are kept.')
        } else {
          const message = error instanceof Error ? error.message : 'Pip could not complete this turn.'
          context.onStatus(message)
          throw error
        }
      } finally {
        context.onBusy(false)
        if (!wroteProgram) context.onCheckpoint(null)
      }
    },
  }
}

function getSessionStorage(): Storage | undefined {
  try { return globalThis.sessionStorage } catch { return undefined }
}

function emptyRepository(): ExportedMessageRepository {
  return { headId: null, messages: [] }
}

function asRepository(value: unknown): ExportedMessageRepository {
  if (!value || typeof value !== 'object') return emptyRepository()
  const candidate = value as { headId?: unknown; messages?: unknown }
  if (!Array.isArray(candidate.messages)) return emptyRepository()
  const items = candidate.messages.flatMap((item: any) => {
    const message = item?.message
    if (!message || typeof message.id !== 'string' || !['user', 'assistant'].includes(message.role) || !Array.isArray(message.content)) return []
    const date = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt)
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
    return [{
      ...item,
      parentId: typeof item.parentId === 'string' ? item.parentId : null,
      message: { ...message, createdAt: safeDate } as ThreadMessage,
    }]
  }).slice(-MAX_HISTORY_MESSAGES)
  const ids = new Set(items.map(item => item.message.id))
  const normalized = items.map(item => ({ ...item, parentId: item.parentId && ids.has(item.parentId) ? item.parentId : null }))
  const lastId = normalized.at(-1)?.message.id ?? null
  return {
    headId: typeof candidate.headId === 'string' && ids.has(candidate.headId) ? candidate.headId : lastId,
    messages: normalized,
  }
}

function migrateLegacy(storage: Storage): ExportedMessageRepository {
  try {
    const raw = storage.getItem(LEGACY_CHAT_STORAGE_KEY)
    if (!raw || raw.length > MAX_HISTORY_CHARS) return emptyRepository()
    const legacy = JSON.parse(raw) as { entries?: Array<{ kind?: string; text?: string }> }
    if (!Array.isArray(legacy.entries)) return emptyRepository()
    const entries = legacy.entries.filter(entry =>
      typeof entry?.text === 'string' && ['user', 'assistant', 'error'].includes(entry.kind ?? ''),
    ).slice(-MAX_HISTORY_MESSAGES)
    let parentId: string | null = null
    const messages = entries.map((entry, index) => {
      const role = entry.kind === 'user' ? 'user' : 'assistant'
      const message = fromThreadMessageLike(
        { role, content: entry.text! },
        `pip-legacy-${index}`,
        { type: 'complete', reason: 'stop' },
      )
      const item = { parentId, message }
      parentId = message.id
      return item
    })
    return { headId: parentId, messages }
  } catch {
    return emptyRepository()
  }
}

export function createPipHistoryAdapter(storage: Storage | undefined = getSessionStorage()): ThreadHistoryAdapter {
  let repository = emptyRepository()
  let loaded = false

  const loadRepository = () => {
    if (!storage) return emptyRepository()
    try {
      const raw = storage.getItem(PIP_CHAT_STORAGE_KEY)
      if (raw && raw.length <= MAX_HISTORY_CHARS) return asRepository(JSON.parse(raw))
      if (raw) return emptyRepository()
      return migrateLegacy(storage)
    } catch {
      return emptyRepository()
    }
  }
  const trim = () => {
    repository = asRepository(repository)
    while (repository.messages.length > 1 && JSON.stringify(repository).length > MAX_HISTORY_CHARS) {
      repository.messages.shift()
      repository = asRepository(repository)
    }
  }
  const save = () => {
    if (!storage) return
    trim()
    try { storage.setItem(PIP_CHAT_STORAGE_KEY, JSON.stringify(repository)) } catch { /* Storage is optional. */ }
  }
  const ensureLoaded = () => {
    if (!loaded) {
      repository = loadRepository()
      loaded = true
    }
  }
  const upsert = (item: ExportedMessageRepository['messages'][number]) => {
    const index = repository.messages.findIndex(entry => entry.message.id === item.message.id)
    if (index < 0) repository.messages.push(item)
    else repository.messages[index] = item
    repository.headId = item.message.id
    save()
  }

  return {
    async load() {
      repository = loadRepository()
      loaded = true
      return structuredClone(repository)
    },
    async append(item) {
      ensureLoaded()
      upsert(item)
    },
    async update(item) {
      ensureLoaded()
      upsert(item)
    },
    async delete(items) {
      ensureLoaded()
      const deleted = new Set(items.map(item => item.message.id))
      const byId = new Map(repository.messages.map(item => [item.message.id, item]))
      const parentAfterDeletion = (id: string | null) => {
        let current = id
        while (current && deleted.has(current)) current = byId.get(current)?.parentId ?? null
        return current
      }
      repository.messages = repository.messages
        .filter(item => !deleted.has(item.message.id))
        .map(item => ({ ...item, parentId: parentAfterDeletion(item.parentId) }))
      repository.headId = parentAfterDeletion(repository.headId ?? null)
      save()
    },
  }
}

export function clearPipChatSession(storage: Storage | undefined = getSessionStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(PIP_CHAT_STORAGE_KEY)
    storage.removeItem(LEGACY_CHAT_STORAGE_KEY)
  } catch { /* Storage is optional. */ }
}
