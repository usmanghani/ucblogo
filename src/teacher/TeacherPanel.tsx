import { createContext, useContext, useMemo, useState } from 'react'
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadAssistantMessagePart,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import type { EveMessage } from 'eve/react'
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
    onNew: async message => {
      const text = message.content.map(part => (part.type === 'text' ? part.text : '')).join('\n').trim()
      if (text) await teacher.send(text)
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

    <TryIt.Provider value={onTry}>
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
                  <h2>The course</h2>
                  <LessonPath completed={completed} current={lesson} onPick={startLesson} disabled={blocked} />
                </>}
              </div>
            </AuiIf>

            <ThreadPrimitive.Messages>
              {({ message }) => <MessagePrimitive.Root className={`message message-${message.role}`}>
                <span className="visually-hidden">{message.role === 'user' ? 'You said:' : 'Pip said:'}</span>
                <MessagePrimitive.Parts>
                  {({ part }) => {
                    if (part.type === 'text') return part.text ? <MessageText text={part.text} student={message.role === 'user'} /> : null
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
              <ComposerPrimitive.Input
                aria-label="Message Pip"
                className="composer-input"
                maxLength={4000}
                placeholder={consent ? 'Ask Pip, or say what you want to draw…' : 'Press “Start learning” to begin'}
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
    </TryIt.Provider>
  </aside>
}

function MessageText({ text, student }: { text: string; student: boolean }) {
  const onTry = useContext(TryIt)
  if (student) return <div className="bubble">{text}</div>
  return <div className="bubble"><Markdown text={text} onTry={onTry} /></div>
}
