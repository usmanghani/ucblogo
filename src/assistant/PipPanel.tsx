import { useMemo, useRef, useState } from 'react'
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ThreadAssistantMessagePart,
} from '@assistant-ui/react'
import type { Workspace } from './agent'
import { clearPipChatSession, createPipChatModelAdapter, createPipHistoryAdapter, type PipRuntimeContext } from './runtime'
import './pip.css'

const MODEL_LABEL = 'DeepSeek V4.1 Flash · OpenRouter'
const toolTitles: Record<string, string> = {
  read_program: 'Read program',
  write_program: 'Write program',
  run_program: 'Run program',
}

function PipToolCard({ part }: { part: Extract<ThreadAssistantMessagePart, { type: 'tool-call' }> }) {
  const title = toolTitles[part.toolName] ?? part.toolName
  const result = part.result === undefined ? 'Waiting for result…' : JSON.stringify(part.result, null, 2)
  const done = part.isPreliminary !== true
  return <details className="pip-tool" open={!done}>
    <summary><span>{done ? (part.isError ? '!' : '✓') : '·'}</span> {title}<small>{done ? (part.isError ? 'Needs attention' : 'Finished') : 'Working'}</small></summary>
    <pre>{result}</pre>
  </details>
}

function PipRuntime({
  workspace,
  consent,
  busy,
  status,
  onStatus,
  onConsentChange,
  onBusy,
  onCheckpoint,
  checkpoint,
  onUndo,
}: {
  workspace: Workspace
  consent: boolean
  busy: boolean
  status: string
  onStatus: (status: string) => void
  onConsentChange: (consent: boolean) => void
  onBusy: (busy: boolean) => void
  onCheckpoint: (checkpoint: { before: string; after: string } | null) => void
  checkpoint: { before: string; after: string } | null
  onUndo: () => void
}) {
  const context = useRef<PipRuntimeContext>({ workspace, consent, onBusy, onStatus, onCheckpoint })
  context.current = { workspace, consent, onBusy, onStatus, onCheckpoint }
  const model = useMemo(() => createPipChatModelAdapter(() => context.current), [])
  const history = useMemo(() => createPipHistoryAdapter(), [])
  const runtime = useLocalRuntime(model, { adapters: { history } })

  return <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root className="pip-runtime">
      <ThreadPrimitive.Viewport className="pip-messages" aria-label="Conversation">
        <AuiIf condition={state => state.thread.isEmpty}>
          <div className="pip-welcome">
            <span className="pip-eyebrow">A LITTLE HELP. BIG IDEAS.</span>
            <h2>What shall we draw?</h2>
            <p>Describe an idea. Pip can write the Logo, run it, and help you make it your own.</p>
            {['Draw a colorful rocket ship', 'Draw a soccer ball', 'Explain my program'].map(prompt =>
              <ThreadPrimitive.Suggestion
                key={prompt}
                className="pip-suggestion"
                prompt={prompt}
                send
                disabled={!consent}
              >{prompt}<span aria-hidden="true">↗</span></ThreadPrimitive.Suggestion>,
            )}
          </div>
        </AuiIf>
        <ThreadPrimitive.Messages>
          {({ message }) => <MessagePrimitive.Root className={`pip-message pip-${message.role}`}>
            <small>{message.role === 'user' ? 'YOU' : 'PIP'}</small>
            <MessagePrimitive.Parts>
              {({ part }) => {
                if (part.type === 'text') {
                  if (!part.text && part.status?.type === 'running') return <div className="pip-thinking">Pip is thinking…</div>
                  return part.text ? <div className="pip-message-content">{part.text}</div> : null
                }
                if (part.type === 'tool-call') return <PipToolCard key={part.toolCallId} part={part} />
                return null
              }}
            </MessagePrimitive.Parts>
            <MessagePrimitive.Error><div className="pip-error">Pip could not complete this turn. Check the status below.</div></MessagePrimitive.Error>
          </MessagePrimitive.Root>}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>

      <footer className="pip-footer">
        <div className="pip-status" role="status">
          <span className={status.includes('thinking') || status.includes('running') || status.includes('checking') ? 'pip-pulse' : ''}/>
          {status}
          {checkpoint && <button type="button" onClick={onUndo}>Undo edits</button>}
        </div>
        <label className="pip-consent">
          <input type="checkbox" checked={consent} disabled={busy} onChange={event => onConsentChange(event.target.checked)} />
          Allow Pip to send my prompts and program code to OpenRouter.
        </label>
        <ComposerPrimitive.Root className="pip-composer" onSubmitCapture={event => {
          if (!consent) {
            event.preventDefault()
            event.stopPropagation()
            onStatus('Allow Pip to send prompts and program code to OpenRouter before sending.')
          }
        }}>
          <ComposerPrimitive.Input
            id="pip-prompt"
            aria-label="Ask Pip"
            className="pip-input"
            maxLength={4000}
            placeholder="Ask Pip to draw, change, or explain…"
            submitMode="enter"
          />
          <div className="pip-compose-actions">
            <small>Agent · {MODEL_LABEL}</small>
            <AuiIf condition={state => state.thread.isRunning}>
              <ComposerPrimitive.Cancel className="pip-send">Stop turn</ComposerPrimitive.Cancel>
            </AuiIf>
            <AuiIf condition={state => !state.thread.isRunning}>
              <ComposerPrimitive.Send className="pip-send" disabled={!consent}>Send ↗</ComposerPrimitive.Send>
            </AuiIf>
          </div>
        </ComposerPrimitive.Root>
        <p className="pip-disclosure">AI usage may incur charges to the configured OpenRouter account. New code runs automatically; edits can be undone.</p>
      </footer>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>
}

export function PipPanel({ workspace, onClose, hidden }: { workspace: Workspace; onClose: () => void; hidden: boolean }) {
  const [threadVersion, setThreadVersion] = useState(0)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Ready when you are')
  const [checkpoint, setCheckpoint] = useState<{ before: string; after: string } | null>(null)

  function undo() {
    if (!checkpoint) return
    if (workspace.read() !== checkpoint.after) {
      setStatus('The program changed after Pip’s edit. Undo was skipped to protect your changes.')
      return
    }
    workspace.write(checkpoint.before)
    setCheckpoint(null)
    setStatus('Restored the program from before Pip’s last turn. The drawing stays until you run or clear it.')
  }

  function newChat() {
    clearPipChatSession()
    setThreadVersion(version => version + 1)
    setCheckpoint(null)
    setStatus('Ready when you are')
  }

  return <aside className="pip-panel" aria-label="Pip assistant" hidden={hidden}>
    <header className="pip-header">
      <div className="pip-identity">
        <svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="19" cy="22" rx="12" ry="10"/><circle cx="33" cy="17" r="5"/><path d="M12 30v4M25 30v4M8 18l-4-2M19 12v20M8 22h23"/><circle cx="34" cy="16" r="1" className="pip-eye"/></svg>
        <div><strong>Pip</strong><small>Your Logo companion</small></div>
      </div>
      <div className="pip-header-actions">
        <button type="button" disabled={busy} title="New chat" aria-label="New chat" onClick={newChat}>New</button>
        <button type="button" aria-label="Close Pip" onClick={onClose}>×</button>
      </div>
    </header>
    <div className="pip-context"><span className="pip-dot"/> Text editor connected <span className="pip-model">{MODEL_LABEL}</span></div>
    <PipRuntime
      key={threadVersion}
      workspace={workspace}
      consent={consent}
      busy={busy}
      status={status}
      onStatus={setStatus}
      onConsentChange={setConsent}
      onBusy={setBusy}
      onCheckpoint={setCheckpoint}
      checkpoint={checkpoint}
      onUndo={undo}
    />
  </aside>
}
