import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Account } from './useAccount'
import type { Programs } from './usePrograms'
import type { SavedProgram } from './api'
import './account.css'

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="sheet-overlay" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <header className="sheet-header"><h2>{title}</h2><button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>×</button></header>
      {children}
    </div>
  </div>
}

/** Sign in or create an account. Signing in is optional; the classroom works without it. */
export function SignInDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus() }, [mode])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'sign-up') await account.signUp(field('name'), field('email'), field('password'))
      else await account.signIn(field('email'), field('password'))
      onClose()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not work. Try again.')
    } finally { setBusy(false) }
  }

  return <Sheet title={mode === 'sign-up' ? 'Create an account' : 'Sign in'} onClose={onClose}>
    <form className="sheet-body account-form" onSubmit={submit}>
      <p>An account keeps your finished lessons and your saved programs, on any computer. You can keep learning without one.</p>
      {mode === 'sign-up' && <label>Your name<input ref={first} name="name" autoComplete="nickname" maxLength={60} required /></label>}
      <label>Email<input ref={mode === 'sign-in' ? first : undefined} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={mode === 'sign-up' ? 8 : 1} maxLength={128} required />
        {mode === 'sign-up' && <small>At least 8 characters.</small>}
      </label>
      {error && <p className="sheet-error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>{mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
      <button type="button" className="link" onClick={() => { setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); setError(null) }}>
        {mode === 'sign-up' ? 'I already have an account' : 'Create a new account'}
      </button>
    </form>
  </Sheet>
}

/** Save the program in the code pane as one of the student's own examples, and manage the rest. */
export function ProgramsDialog({ programs, account, getSource, onOpen, onSignIn, onClose }: {
  programs: Programs
  account: Account
  getSource: () => string
  onOpen: (program: SavedProgram) => void
  onSignIn: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)

  async function run(action: () => Promise<void>, done?: string) {
    setBusy(true)
    setNote(null)
    try {
      await action()
      if (done) setNote({ kind: 'done', text: done })
    } catch (problem) {
      setNote({ kind: 'error', text: problem instanceof Error ? problem.message : 'That did not work. Try again.' })
    } finally { setBusy(false) }
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    const name = title.trim()
    void run(async () => { await programs.save(name, getSource()); setTitle('') }, `Saved “${name}”.`)
  }

  return <Sheet title="My programs" onClose={onClose}>
    <div className="sheet-body">
      <form className="save-program" onSubmit={save}>
        <label htmlFor="program-title">Save the program in your code pane as a new example</label>
        <div className="save-row">
          <input id="program-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Name it, like “My house”" maxLength={80} required />
          <button type="submit" className="primary" disabled={busy}>Save</button>
        </div>
      </form>
      {note && <p className={note.kind === 'error' ? 'sheet-error' : 'sheet-done'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
      {programs.error && <p className="sheet-error" role="alert">{programs.error}</p>}

      {programs.programs.length === 0
        ? <p className="sheet-empty">Nothing saved yet. Programs you save show up here and in the Examples menu.</p>
        : <ul className="program-list" aria-label="Saved programs">
          {programs.programs.map(program => <li key={program.id}>
            <span className="program-title">{program.title}</span>
            <button type="button" onClick={() => { onOpen(program); onClose() }}>Open</button>
            <button type="button" className="danger" disabled={busy} aria-label={`Delete ${program.title}`}
              onClick={() => { if (window.confirm(`Delete “${program.title}”? This cannot be undone.`)) void run(() => programs.remove(program.id)) }}>Delete</button>
          </li>)}
        </ul>}

      <p className="sheet-foot">
        {programs.where === 'account'
          ? <>Saved to your account ({account.user?.email}).</>
          : account.available
            ? <>Saved in this browser only. <button type="button" className="link" onClick={onSignIn}>Sign in</button> to keep them with your account.</>
            : <>Saved in this browser only.</>}
      </p>
    </div>
  </Sheet>
}
