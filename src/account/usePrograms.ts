import { useCallback, useEffect, useRef, useState } from 'react'
import { accountApi, type AccountUser, type SavedProgram } from './api'

export const LOCAL_PROGRAMS_KEY = 'logo-teacher.programs.v1'
const MAX_LOCAL = 50

function readLocal(): SavedProgram[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(LOCAL_PROGRAMS_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.source === 'string') : []
  } catch { return [] }
}
function writeLocal(programs: SavedProgram[]) {
  try {
    if (programs.length) localStorage.setItem(LOCAL_PROGRAMS_KEY, JSON.stringify(programs))
    else localStorage.removeItem(LOCAL_PROGRAMS_KEY)
  } catch { throw new Error('This browser would not save the program. Its storage may be full or blocked.') }
}

/**
 * The student's own example programs. Anonymous students keep them in this browser.
 * Signed-in students keep them in their account, and programs saved before signing in
 * move into the account the first time they do.
 */
export function usePrograms(user: AccountUser | null) {
  const [programs, setPrograms] = useState<SavedProgram[]>(readLocal)
  const [error, setError] = useState<string | null>(null)
  const email = user?.email ?? null
  const signedIn = useRef(email)
  signedIn.current = email

  useEffect(() => {
    if (!email) { setPrograms(readLocal()); return }
    let current = true
    void (async () => {
      try {
        // Oldest first, so the account lists them in the order they were made.
        for (const program of readLocal().reverse()) await accountApi.saveProgram(program.title, program.source)
        writeLocal([])
        const mine = await accountApi.listPrograms()
        if (current) { setPrograms(mine); setError(null) }
      } catch (problem) {
        if (current) setError(problem instanceof Error ? problem.message : 'Could not load your programs.')
      }
    })()
    return () => { current = false }
  }, [email])

  const save = useCallback(async (title: string, source: string) => {
    const name = title.trim()
    if (!name) throw new Error('Give your program a name.')
    if (!source.trim()) throw new Error('There is no program to save yet.')
    if (signedIn.current) {
      const program = await accountApi.saveProgram(name, source)
      setPrograms(previous => [program, ...previous])
      return
    }
    const local = readLocal()
    if (local.length >= MAX_LOCAL) throw new Error(`This browser can keep ${MAX_LOCAL} programs. Delete one, or sign in to keep more.`)
    const next = [{ id: crypto.randomUUID(), title: name.slice(0, 80), source, updatedAt: new Date().toISOString() }, ...local]
    writeLocal(next)
    setPrograms(next)
  }, [])

  const remove = useCallback(async (id: string) => {
    if (signedIn.current) await accountApi.deleteProgram(id)
    else writeLocal(readLocal().filter(program => program.id !== id))
    setPrograms(previous => previous.filter(program => program.id !== id))
  }, [])

  return { programs, save, remove, error, where: email ? 'account' as const : 'browser' as const }
}

export type Programs = ReturnType<typeof usePrograms>
