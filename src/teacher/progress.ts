import { useCallback, useState } from 'react'
import { lessons } from './lessons'

export const PROGRESS_KEY = 'logo-teacher.progress.v1'
export const CONSENT_KEY = 'logo-teacher.consent.v1'

function read(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(saved) ? lessons.map(lesson => lesson.id).filter(id => saved.includes(id)) : []
  } catch { return [] }
}

/** Which lessons this browser has finished. Progress outlives a chat and a tab. */
export function useProgress() {
  const [completed, setCompleted] = useState(read)
  const complete = useCallback((id: string) => {
    if (!lessons.some(lesson => lesson.id === id)) return
    setCompleted(previous => {
      if (previous.includes(id)) return previous
      const next = [...previous, id]
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch { /* progress is a convenience */ }
      return next
    })
  }, [])
  return { completed, complete }
}

/** The student agrees once per browser to their messages and code going to the AI model. */
export function useConsent() {
  const [consent, setConsent] = useState(() => {
    try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false }
  })
  const accept = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, 'yes') } catch { /* asked again next visit */ }
    setConsent(true)
  }, [])
  return { consent, accept }
}
