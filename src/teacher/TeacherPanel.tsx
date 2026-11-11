import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  AssistantRuntimeProvider,
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadAssistantMessagePart,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import type { EveMessage } from 'eve/react'
import { drawingAttachments } from './drawing'
import { lessonById, lessons, type Lesson } from './lessons'
import { Markdown } from './Markdown'
import type { Teacher } from './useTeacher'
import './teacher.css'

type ToolPart = Extract<ThreadAssistantMessagePart, { type: 'tool-call' }>
type ContentPart = Exclude<ThreadMessageLike['content'], string>[number]

const SETTLED = new Set(['completed', 'failed', 'rejected', 'cancelled'])

/** Map an eve message onto assistant-ui's message shape. Pip's private reasoning is not shown. */
export function toThreadMessage(message: EveMessage): ThreadMessageLike {
  const content: ContentPart[] = []
  for (const part of message.parts) {
    if (part.type === 'text' && part.text) content.push({ type: 'text', text: part.text })
    // A picture the student attached. Its address is only known while this tab still holds it.
    if (part.type === 'file' && part.mediaType.startsWith('image/')) content.push({ type: 'image', image: part.url ?? '' })
    if (part.type === 'tool') {
      const settled = SETTLED.has(part.state)
      content.push({
        type: 'tool-call',
        toolCallId: part.callId,
        toolName: part.name,
        args: (part.input ?? {}) as never,
        ...(settled ? { result: part.output ?? { errors: [{ message: 'This step did not finish.' }] }, isError: part.state !== 'completed' } : {}),
      })
    }
  }
  return { id: message.id, role: message.role, content }
}

/** What is sent when a student attaches a drawing and types nothing. */
export const DRAWING_REQUEST = 'Here is my drawing. Can you turn it into a Logo program?'

/** Pictures this tab sent, by message id. Read at render time: converted messages are cached. */
const Drawings = createContext<ReadonlyMap<string, string>>(new Map())

const TryIt = createContext<((code: string) => void) | undefined>(undefined)

function ToolNote({ part }: { part: ToolPart }) {
  const done = part.result !== undefined
  const result = (part.result ?? {}) as { ok?: boolean; errors?: Array<{ message?: string; line?: number }>; completed?: string }
  const problem = part.isError ? 'This step did not finish.' : result.errors?.[0]
  const problemText = typeof problem === 'string' ? problem : problem ? `${problem.message ?? 'Something went wrong'}${problem.line ? ` (line ${problem.line})` : ''}` : ''
  let label: string
  if (part.toolName === 'write_program') label = !done ? 'Writing a program…' : problemText ? 'Pip’s program hit a problem' : 'Pip put a program in your code pane'
  else if (part.toolName === 'test_program') label = !done ? 'Checking some code…' : problemText ? 'Pip found a problem while checking' : 'Pip checked some code'
  else if (part.toolName === 'complete_lesson') label = !done ? 'Marking the lesson complete…' : `Lesson complete: ${lessonById(result.completed)?.title ?? 'well done'}`
  else return null
  const tone = !done ? 'working' : problemText ? 'problem' : part.toolName === 'complete_lesson' ? 'star' : 'done'
  return <div className={`tool-note tool-${tone}`}>
    <span className="tool-mark" aria-hidden="true">{tone === 'star' ? '★' : tone === 'problem' ? '!' : tone === 'done' ? '✓' : ''}</span>
    <span>{label}{problemText && <small>{problemText}</small>}</span>
  </div>
}

export function LessonPath({ completed, current, onPick, disabled }: { completed: string[]; current: string | null; onPick: (lesson: Lesson) => void; disabled?: boolean }) {
  return <ol className="lesson-path" aria-label="Lessons">
    {lessons.map((lesson, index) => {
      const done = completed.includes(lesson.id)
      return <li key={lesson.id}>
        <button type="button" disabled={disabled} className={`lesson-step${done ? ' is-done' : ''}${current === lesson.id ? ' is-current' : ''}`} onClick={() => onPick(lesson)}>
          <span className="lesson-number" aria-hidden="true">{done ? '✓' : index + 1}</span>
          <span className="lesson-text"><strong>{lesson.title}</strong><small>{lesson.blurb}</small></span>
          {done && <span className="visually-hidden">(finished)</span>}
        </button>
      </li>
    })}
  </ol>
}

export function PipFace() {
  return <svg className="pip-face" viewBox="0 0 48 48" aria-hidden="true">
    <ellipse cx="22" cy="28" rx="15" ry="12" className="pip-shell" />
    <path d="M12 28h20M22 17v22M15 20l14 16M29 20 15 36" className="pip-lines" />
    <circle cx="39" cy="20" r="6.5" className="pip-head" />
    <circle cx="41" cy="19" r="1.3" className="pip-eye" />
    <path d="M12 38v5M30 38v5" className="pip-legs" />
  </svg>
}

export interface TeacherPanelProps {
  teacher: Teacher
  consent: boolean
  onConsent: () => void
  completed: string[]
  lesson: string | null
  onLesson: (lesson: Lesson | null) => void
  onTry: (code: string) => void
  /** A problem from the student's own last run that Pip has not been asked about yet. */
  runProblem: string | null
}

export function TeacherPanel({ teacher, consent, onConsent, completed, lesson, onLesson, onTry, runProblem }: TeacherPanelProps) {
  const [showLessons, setShowLessons] = useState(false)
  const blocked = !consent || teacher.resuming
  const runtime = useExternalStoreRuntime({
    messages: teacher.messages as EveMessage[],
    isRunning: teacher.working,
    isDisabled: blocked,
    convertMessage: toThreadMessage,
    adapters: { attachments: drawingAttachments },
    onNew: async message => {
      const text = message.content.map(part => (part.type === 'text' ? part.text : '')).join('\n').trim()
      const drawings = (message.attachments ?? []).flatMap(attachment => (attachment.content ?? []).flatMap(part => (part.type === 'image' ? [part.image] : [])))
      if (text || drawings.length) await teacher.send(text || DRAWING_REQUEST, drawings.slice(0, 1))
    },
    onCancel: teacher.stop,
  })
  const open = lessonById(lesson)
  const nextLesson = useMemo(() => lessons.find(item => !completed.includes(item.id)) ?? null, [completed])

  const startLesson = (picked: Lesson) => {
    setShowLessons(false)
    onLesson(picked)
    void teacher.send(`Let's do the lesson "${picked.title}".`)
  }

  return <aside className="teacher" aria-label="Pip, your Logo teacher">
    <header className="teacher-header">
      <PipFace />
      <div className="teacher-name">
        <strong>Pip</strong>
        <small>{open ? `Lesson: ${open.title}` : 'Your Logo teacher'}</small>
      </div>
      <div className="teacher-actions">
        <button type="button" aria-expanded={showLessons} onClick={() => setShowLessons(value => !value)}>Lessons <span className="count">{completed.length}/{lessons.length}</span></button>
        <button type="button" disabled={teacher.working} onClick={() => { onLesson(null); teacher.newChat() }}>New chat</button>
      </div>
    </header>

    {showLessons && <div className="lesson-drawer">
      <LessonPath completed={completed} current={lesson} onPick={startLesson} disabled={blocked || teacher.working} />
    </div>}

    <Drawings.Provider value={teacher.drawings}><TryIt.Provider value={onTry}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="thread">
          <ThreadPrimitive.Viewport className="thread-viewport" aria-label="Conversation with Pip">
            <AuiIf condition={state => state.thread.isEmpty}>
              <div className="welcome">
                <h1>Learn Logo by drawing.</h1>
                <p>I’m Pip. Tell the turtle where to go and it draws as it walks. I’ll show you one idea at a time, and you try each one in the code pane.</p>
                {!consent && <div className="consent">
                  <p>Pip is an AI. What you type here, and the program in your code pane, are sent to an AI model so Pip can answer. Don’t share personal details.</p>
                  <button type="button" className="primary" onClick={onConsent}>Start learning</button>
                </div>}
                {consent && <>
                  {nextLesson && <button type="button" className="primary" disabled={blocked} onClick={() => startLesson(nextLesson)}>
                    {completed.length ? `Continue: ${nextLesson.title}` : `Start lesson 1: ${nextLesson.title}`}
                  </button>}
                  <div className="suggestions">
                    {['Draw a rocket ship', 'Explain my program', 'Give me a challenge'].map(prompt =>
                      <ThreadPrimitive.Suggestion key={prompt} className="suggestion" prompt={prompt} send>{prompt}</ThreadPrimitive.Suggestion>)}
                  </div>
                  <p className="drawing-hint">Drew something on paper? Use the picture button below and I’ll help the turtle draw it.</p>
                  <h2>The course</h2>
                  <LessonPath completed={completed} current={lesson} onPick={startLesson} disabled={blocked} />
                </>}
              </div>
            </AuiIf>

            <ThreadPrimitive.Messages>
              {({ message }) => <MessagePrimitive.Root className={`message message-${message.role}`}>
                <span className="visually-hidden">{message.role === 'user' ? 'You said:' : 'Pip said:'}</span>
                {message.role === 'user' && <SentDrawing messageId={message.id} />}
                <MessagePrimitive.Parts>
                  {({ part }) => {
                    if (part.type === 'text') return part.text ? <MessageText text={part.text} student={message.role === 'user'} /> : null
                    if (part.type === 'image') return <SentDrawingNote src={part.image} messageId={message.id} />
                    if (part.type === 'tool-call') return <ToolNote key={part.toolCallId} part={part} />
                    return null
                  }}
                </MessagePrimitive.Parts>
              </MessagePrimitive.Root>}
            </ThreadPrimitive.Messages>

            {teacher.working && <div className="thinking" role="status"><span /><span /><span /><em className="visually-hidden">Pip is thinking</em></div>}
            {teacher.failure && <div className="failure" role="alert">{teacher.failure}</div>}
          </ThreadPrimitive.Viewport>

          <footer className="composer-area">
            {runProblem && consent && !teacher.working && <button type="button" className="run-problem" onClick={() => void teacher.send(`My program stopped with this message: ${runProblem}\nCan you help me understand what went wrong?`)}>
              <span>Your program stopped: <em>{runProblem}</em></span><strong>Ask Pip</strong>
            </button>}
            <ComposerPrimitive.Root className="composer">
              <div className="composer-drawings">
                <ComposerPrimitive.Attachments>{({ attachment }) => <DrawingChip file={'file' in attachment ? attachment.file : undefined} />}</ComposerPrimitive.Attachments>
              </div>
              <ComposerPrimitive.AddAttachment className="composer-attach" aria-label="Add a picture of your drawing" title="Add a picture of your drawing">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3L16 12l4 4" /></svg>
              </ComposerPrimitive.AddAttachment>
              <ComposerPrimitive.Input
                aria-label="Message Pip"
                className="composer-input"
                maxLength={4000}
                placeholder={consent ? 'Ask Pip, or show Pip a drawing…' : 'Press “Start learning” to begin'}
                submitMode="enter"
              />
              <AuiIf condition={state => state.thread.isRunning}>
                <ComposerPrimitive.Cancel className="composer-button is-stop">Stop</ComposerPrimitive.Cancel>
              </AuiIf>
              <AuiIf condition={state => !state.thread.isRunning}>
                <ComposerPrimitive.Send className="composer-button">Send</ComposerPrimitive.Send>
              </AuiIf>
            </ComposerPrimitive.Root>
            <p className="fine-print">Pip is an AI and can make mistakes. Run the code and see for yourself.</p>
          </footer>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </TryIt.Provider></Drawings.Provider>
  </aside>
}

/** The picture this tab sent with a message, if any. */
function SentDrawing({ messageId }: { messageId: string }) {
  const mine = useContext(Drawings).get(messageId)
  return mine ? <img className="sent-drawing" src={mine} alt="The drawing you sent" /> : null
}

/** A stored attachment this tab no longer holds, such as after a reload. */
function SentDrawingNote({ src, messageId }: { src: string; messageId: string }) {
  const mine = useContext(Drawings).get(messageId)
  if (mine) return null
  return src ? <img className="sent-drawing" src={src} alt="The drawing you sent" /> : <div className="sent-drawing-note">You sent a drawing</div>
}

function DrawingChip({ file }: { file?: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) return
    const address = URL.createObjectURL(file)
    setUrl(address)
    return () => URL.revokeObjectURL(address)
  }, [file])
  return <AttachmentPrimitive.Root className="drawing-chip">
    {url && <img src={url} alt="" />}
    <span>Your drawing</span>
    <AttachmentPrimitive.Remove aria-label="Remove the picture">×</AttachmentPrimitive.Remove>
  </AttachmentPrimitive.Root>
}

function MessageText({ text, student }: { text: string; student: boolean }) {
  const onTry = useContext(TryIt)
  if (student) return <div className="bubble">{text}</div>
  return <div className="bubble"><Markdown text={text} onTry={onTry} /></div>
}
