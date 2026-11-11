import { useCallback, useEffect, useRef, useState } from 'react'
import { accountApi } from '../account/api'
import { lessons } from './lessons'

export const PROGRESS_KEY = 'logo-teacher.progress.v1'
export const CONSENT_KEY = 'logo-teacher.consent.v1'

function read(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(saved) ? lessons.map(lesson => lesson.id).filter(id => saved.includes(id)) : []
  } catch { return [] }
}

const inOrder = (ids: Iterable<string>) => { const done = new Set(ids); return lessons.map(lesson => lesson.id).filter(id => done.has(id)) }
function writeLocal(completed: string[]) {
  try {
    if (completed.length) localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed))
    else localStorage.removeItem(PROGRESS_KEY)
  } catch { /* progress is a convenience */ }
}

/**
 * Which lessons the student has finished. Anonymous progress lives in this browser.
 * When a student signs in, what they did anonymously is added to their account, and
 * from then on the account is the record. Signing out clears the browser's copy so the
 * next student at the same computer starts fresh.
 */
export function useProgress(user: { email: string } | null = null) {
  const [completed, setCompleted] = useState(read)
  const email = user?.email ?? null
  const wasSignedIn = useRef(false)

  useEffect(() => {
    if (!email) {
      if (wasSignedIn.current) { wasSignedIn.current = false; writeLocal([]); setCompleted([]) }
      return
    }
    wasSignedIn.current = true
    let current = true
    accountApi.addProgress(read())
      .then(saved => { if (current) { writeLocal(inOrder(saved)); setCompleted(inOrder(saved)) } })
      .catch(() => { /* keep showing local progress; the next finished lesson tries again */ })
    return () => { current = false }
  }, [email])

  const complete = useCallback((id: string) => {
    if (!lessons.some(lesson => lesson.id === id)) return
    setCompleted(previous => {
      if (previous.includes(id)) return previous
      const next = inOrder([...previous, id])
      writeLocal(next)
      return next
    })
    if (email) accountApi.addProgress([id]).catch(() => { /* still recorded locally; synced at next sign-in */ })
  }, [email])
  return { completed, complete }
}

export function hasConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false }
}

/** The student agrees once per browser to their messages and code going to the AI model. */
export function useConsent() {
  const [consent, setConsent] = useState(hasConsent)
  const accept = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, 'yes') } catch { /* asked again next visit */ }
    setConsent(true)
  }, [])
  return { consent, accept }
}
