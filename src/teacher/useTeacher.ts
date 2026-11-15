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

  // Show the student's own picture in the conversation. The server stores it but does not
  // hand back an address, and how it echoes the attachment varies, so each picture is tied
  // to its message by position at the moment it is sent. After a reload it shows as a note.
  const [sentDrawings, setSentDrawings] = useState<ReadonlyArray<{ position: number; image: string }>>([])
  const userMessages = useMemo(() => agent.messages.filter(message => message.role === 'user'), [agent.messages])
  const userCount = useRef(0)
  userCount.current = userMessages.length
  const drawings = useMemo(() => {
    const shown = new Map<string, string>()
    for (const { position, image } of sentDrawings) if (userMessages[position]) shown.set(userMessages[position].id, image)
    return shown
  }, [userMessages, sentDrawings])

  const turnOpen = activeTurn(agent.view) !== undefined
  const working = turnOpen || agent.status === 'busy'

  const send = useCallback(async (text: string, drawings: readonly string[] = []) => {
    setFailure(null)
    if (drawings.length) { const position = userCount.current; setSentDrawings(previous => [...previous, { position, image: drawings[0] }]) }
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
