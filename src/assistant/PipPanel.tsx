import { useEffect, useRef, useState } from 'react'
import { runAgent, type AgentEvent, type Workspace } from './agent'
import type { Message } from './protocol'
import './pip.css'

interface Entry { kind: 'user' | 'assistant' | 'tool' | 'error'; text: string; id?: string; result?: string; failed?: boolean }
const storageKey = 'ucblogo.pip.chat.v1'
function savedChat(): { messages: Message[]; entries: Entry[] } {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw || raw.length > 200000) return { messages: [], entries: [] }
    const data = JSON.parse(raw)
    if (Array.isArray(data.messages) && Array.isArray(data.entries) && data.entries.every((e: Entry) => typeof e?.text === 'string' && ['user', 'assistant', 'tool', 'error'].includes(e.kind))) return data
  } catch { /* Storage is optional in private browsing. */ }
  return { messages: [], entries: [] }
}
const toolTitles: Record<string, string> = { read_program: 'Read program', write_program: 'Write program', run_program: 'Run program' }

export function PipPanel({ workspace, onClose, hidden }: { workspace: Workspace; onClose: () => void; hidden: boolean }) {
  const [initial] = useState(savedChat)
  const history = useRef<Message[]>(initial.messages)
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const [prompt, setPrompt] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Ready when you are')
  const [model, setModel] = useState('OpenRouter · Free')
  const controller = useRef<AbortController | null>(null)
  const checkpoint = useRef<{ before: string; after: string } | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'nearest' }) }, [entries, status])
  useEffect(() => {
    if (busy) return
    try { sessionStorage.setItem(storageKey, JSON.stringify({ messages: history.current, entries })) } catch { /* Program saving is independent. */ }
  }, [entries, busy])

  async function send(text = prompt) {
    if (!consent || !text.trim() || controller.current) return
    const aborter = new AbortController()
    controller.current = aborter
    setBusy(true); setPrompt(''); setCanUndo(false); checkpoint.current = null
    const before = workspace.read()
    let wrote = false
    const messages: Message[] = [...history.current, { role: 'user', content: text.trim() }]
    setEntries(e => [...e, { kind: 'user', text: text.trim() }])
    function emit(event: AgentEvent) {
      if (event.type === 'status') { setStatus(event.text); return }
      if (event.type === 'model') { setModel(event.text); return }
      setEntries(items => {
        const next = [...items]
        if (event.type === 'text') {
          const last = next.at(-1)
          if (last?.kind === 'assistant') next[next.length - 1] = { ...last, text: last.text + event.text }
          else next.push({ kind: 'assistant', text: event.text })
        } else if (event.type === 'tool') next.push({ kind: 'tool', text: toolTitles[event.text] || event.text, id: event.id })
        else {
          const index = next.findIndex(e => e.kind === 'tool' && e.id === event.id)
          if (index >= 0) next[index] = { ...next[index], result: event.text, failed: Boolean(JSON.parse(event.text).error || JSON.parse(event.text).errors?.length) }
        }
        return next
      })
    }
    try {
      history.current = await runAgent(messages, {
        ...workspace,
        write: code => { workspace.write(code); wrote = true; checkpoint.current = { before, after: code } },
      }, aborter.signal, emit)
      setStatus('Turn complete')
    } catch (error) {
      const message = aborter.signal.aborted ? 'Turn stopped. Any completed edits are kept.' : error instanceof Error ? error.message : String(error)
      // Persist only complete conversation boundaries, never dangling tool calls.
      history.current = [...messages, { role: 'assistant', content: `Turn interrupted: ${message}. Read the editor before continuing.` }]
      setEntries(e => [...e, { kind: 'error', text: message }]); setStatus(aborter.signal.aborted ? 'Stopped' : 'Needs attention')
    } finally { controller.current = null; setBusy(false); setCanUndo(wrote) }
  }
  function undo() {
    const change = checkpoint.current
    if (!change) return
    if (workspace.read() !== change.after) {
      setEntries(e => [...e, { kind: 'error', text: 'The program changed after Pip’s edit. Undo was skipped to protect your changes.' }]); return
    }
    workspace.write(change.before); checkpoint.current = null; setCanUndo(false)
    history.current.push({ role: 'user', content: 'I undid your last program edits.' }, { role: 'assistant', content: 'Understood. I will read the current editor before making further changes.' })
    setEntries(e => [...e, { kind: 'assistant', text: 'Restored the program from before my last turn. The drawing stays until you run or clear it.' }])
  }
  return <aside className="pip-panel" aria-label="Pip assistant" hidden={hidden}>
    <header className="pip-header">
      <div className="pip-identity"><svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="19" cy="22" rx="12" ry="10"/><circle cx="33" cy="17" r="5"/><path d="M12 30v4M25 30v4M8 18l-4-2M19 12v20M8 22h23"/><circle cx="34" cy="16" r="1" className="pip-eye"/></svg><div><strong>Pip</strong><small>Your Logo companion</small></div></div>
      <div className="pip-header-actions"><button disabled={busy} title="New chat" aria-label="New chat" onClick={() => { history.current = []; setEntries([]); setStatus('Ready when you are'); setCanUndo(false); checkpoint.current = null; try { sessionStorage.removeItem(storageKey) } catch { /* Optional storage. */ } }}>New</button><button aria-label="Close Pip" onClick={onClose}>×</button></div>
    </header>
    <div className="pip-context"><span className="pip-dot"/> Text editor connected <span className="pip-free">FREE</span></div>
    <div className="pip-messages" aria-label="Conversation">
      {!entries.length && <div className="pip-welcome"><span className="pip-eyebrow">A LITTLE HELP. BIG IDEAS.</span><h2>What shall we draw?</h2><p>Describe an idea. I’ll write the Logo, run it, and help you make it your own.</p>{['Draw a colorful rocket ship', 'Draw a soccer ball', 'Explain my program'].map(s => <button key={s} disabled={!consent} onClick={() => void send(s)}>{s}<span>↗</span></button>)}</div>}
      {entries.map((entry, i) => entry.kind === 'tool'
        ? <details className="pip-tool" key={i}><summary><span>{entry.result ? (entry.failed ? '!' : '✓') : '·'}</span> {entry.text}<small>{entry.result ? (entry.failed ? 'Needs attention' : 'Finished') : busy ? 'Working' : 'Interrupted'}</small></summary><pre>{entry.result || 'Waiting for result…'}</pre></details>
        : <div key={i} className={`pip-message pip-${entry.kind}`}><small>{entry.kind === 'user' ? 'YOU' : entry.kind === 'error' ? 'NOTICE' : 'PIP'}</small><div>{entry.text}</div></div>)}
      <div ref={bottom}/>
    </div>
    <footer className="pip-footer"><div className="pip-status" role="status"><span className={busy ? 'pip-pulse' : ''}/>{status}{canUndo && !busy && <button onClick={undo}>Undo edits</button>}</div>
      <label className="pip-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />Allow Pip to send my prompts and program to OpenRouter and its model providers.</label>
      <form onSubmit={e => { e.preventDefault(); void send() }}><label className="sr-only" htmlFor="pip-prompt">Ask Pip</label><textarea id="pip-prompt" value={prompt} maxLength={4000} placeholder="Ask Pip to draw, change, or explain…" disabled={busy} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }}/><div className="pip-compose-actions"><small>Agent · {model}</small>{busy ? <button type="button" onClick={() => controller.current?.abort()}>Stop turn</button> : <button type="submit" disabled={!consent || !prompt.trim()}>Send ↗</button>}</div></form>
      <p className="pip-disclosure">Pip can edit and run the text program. Prompts and code are sent to OpenRouter. Edits can be undone.</p>
    </footer>
  </aside>
}
