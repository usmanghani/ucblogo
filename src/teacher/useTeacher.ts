import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { activeTurn } from 'eve/events'
import { useEveAgent, type EveMessage } from 'eve/react'
import { hasConsent } from './progress'
import type { ClientSessionState, SessionStreamEvent } from 'eve/client'

export const CHAT_KEY = 'logo-teacher.chat.v1'
const MAX_SAVED_CHARS = 1_500_000

/** What the page tells Pip about the student's workspace with every message. */
export interface PageSnapshot {
  program: string
  lastRun: { by: 'student' | 'pip'; current: boolean; output: string; errors: string[]; stopped: boolean } | null
  lesson: string | null
  completed: string[]
}

export interface TeacherHandlers {
  getPage: () => PageSnapshot
  /** Pip wrote a program for the student's code pane. */
  onProgram: (code: string) => void
  onLessonComplete: (lessonId: string) => void
}

interface SavedChat { events?: readonly SessionStreamEvent[]; session?: ClientSessionState }

function loadChat(): SavedChat {
  // Without consent nothing may reach Pip, and resuming a saved chat is a request to Pip.
  if (!hasConsent()) return {}
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? '{}')
    return saved && typeof saved === 'object' ? saved as SavedChat : {}
  } catch { return {} }
}

function saveChat(chat: SavedChat) {
  try {
    let text = JSON.stringify(chat)
    // A long chat can outgrow storage. Keep the cursor alone: the server still has the conversation.
    if (text.length > MAX_SAVED_CHARS) text = JSON.stringify({ session: chat.session })
    sessionStorage.setItem(CHAT_KEY, text)
  } catch { /* the chat simply will not survive a reload */ }
}

const hasDrawing = (message: EveMessage) => message.role === 'user' && message.parts.some(part => part.type === 'file')

const toolCalls = (messages: readonly EveMessage[]) => messages.flatMap(message => message.parts.flatMap(part => (part.type === 'tool' ? [part] : [])))

/** Explain a failure in words a student can act on. */
export function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/helping a lot of students|not set up yet|only answers its own pages/i.test(raw)) return raw
  if (/413|415|too large|media type/i.test(raw)) return 'Pip could not take that picture. Try a smaller photo or a PNG or JPEG.'
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return 'Pip cannot be reached. Check your connection, then try again.'
  if (/401|403|unauthor|forbidden/i.test(raw)) return 'Pip is not available on this site right now.'
  if (/429|rate/i.test(raw)) return 'Pip is helping a lot of students right now. Wait a minute, then try again.'
  if (/gateway|model|provider|credential|api key/i.test(raw)) return 'Pip could not reach its AI model. Try again in a moment.'
  return raw ? `Pip ran into a problem: ${raw.slice(0, 200)}` : 'Pip ran into a problem. Try again.'
}

/** Pip's side of the classroom: the eve session, its saved history, and what Pip's tools do to the page. */
export function useTeacher(handlers: TeacherHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const [saved] = useState(loadChat)
  const [failure, setFailure] = useState<string | null>(null)

  const agent = useEveAgent({
    initialEvents: saved.events ?? [],
    initialSession: saved.session,
    resume: saved.session !== undefined,
    prepareSend: input => ({ ...input, clientContext: { ...handlersRef.current.getPage() } }),
    onError: error => setFailure(describeError(error)),
  })

  useEffect(() => { saveChat({ events: agent.events, session: agent.session }) }, [agent.events, agent.session])

  // Act on each finished tool call exactly once. Calls already on screen when the page
  // loads (a restored chat) are history, and must not overwrite what the student has now.
  const handled = useRef<Set<string> | null>(null)
  if (handled.current === null) handled.current = new Set(toolCalls(agent.messages).map(call => call.callId))
  useEffect(() => {
    const seen = handled.current!
    for (const call of toolCalls(agent.messages)) {
      if (seen.has(call.callId)) continue
      if (agent.status === 'resuming') { seen.add(call.callId); continue }
      if (call.state !== 'completed') continue
      seen.add(call.callId)
      const input = (call.input ?? {}) as Record<string, unknown>
      if (call.name === 'write_program' && typeof input.code === 'string') handlersRef.current.onProgram(input.code)
      if (call.name === 'complete_lesson' && typeof input.lesson_id === 'string') handlersRef.current.onLessonComplete(input.lesson_id)
    }
  }, [agent.messages, agent.status])

  // The server keeps a sent picture but does not hand back an address for it, so remember
  // this tab's own pictures to show them in the conversation. After a reload they show as a note.
  const [sentDrawings, setSentDrawings] = useState<readonly string[]>([])
  const [restoredDrawings, setRestoredDrawings] = useState(() => agent.messages.filter(hasDrawing).length)
  const drawings = useMemo(() => {
    const shown = new Map<string, string>()
    agent.messages.filter(hasDrawing).slice(restoredDrawings).forEach((message, index) => { if (sentDrawings[index]) shown.set(message.id, sentDrawings[index]) })
    return shown
  }, [agent.messages, sentDrawings, restoredDrawings])

  const turnOpen = activeTurn(agent.view) !== undefined
  const working = turnOpen || agent.status === 'busy'

  const send = useCallback(async (text: string, drawings: readonly string[] = []) => {
    setFailure(null)
    if (drawings.length) setSentDrawings(previous => [...previous, drawings[0]])
    try {
      await agent.send(drawings.length
        ? [{ type: 'text', text }, ...drawings.map((data, index) => ({ type: 'file' as const, data, mediaType: data.slice(5, data.indexOf(';')), filename: `drawing-${index + 1}.jpg` }))]
        : text)
    } catch (error) { setFailure(describeError(error)) }
  }, [agent])

  const stop = useCallback(async () => {
    try { await agent.cancel() } catch { /* the turn may already have ended */ }
  }, [agent])

  const newChat = useCallback(() => {
    try { sessionStorage.removeItem(CHAT_KEY) } catch { /* nothing saved */ }
    handled.current = new Set()
    setSentDrawings([])
    setRestoredDrawings(0)
    setFailure(null)
    agent.newSession()
  }, [agent])

  return useMemo(() => ({
    messages: agent.messages,
    drawings,
    working,
    resuming: agent.status === 'resuming',
    failure,
    send,
    stop,
    newChat,
  }), [agent.messages, agent.status, drawings, working, failure, send, stop, newChat])
}

export type Teacher = ReturnType<typeof useTeacher>
