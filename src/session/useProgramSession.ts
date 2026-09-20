import { useState } from 'react'

export const PROGRAM_SESSION_KEY = 'ucblogo.program.session.v1'

/** Per-tab draft: survives refresh without sharing edits with other tabs. */
export function useProgramSession(initialProgram: string) {
  const [state, setState] = useState(() => {
    try {
      return { program: sessionStorage.getItem(PROGRAM_SESSION_KEY) ?? initialProgram, error: '' }
    } catch {
      return { program: initialProgram, error: 'Browser session storage is unavailable. Changes will not survive refresh.' }
    }
  })

  function saveProgram(program: string) {
    let error = ''
    try {
      sessionStorage.setItem(PROGRAM_SESSION_KEY, program)
    } catch {
      error = 'Could not save this program in the browser. Save a copy before refreshing.'
    }
    setState({ program, error })
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(PROGRAM_SESSION_KEY)
      setState({ program: '', error: '' })
      return true
    } catch {
      setState(previous => ({ ...previous, error: 'Could not clear the saved session. Your program has been kept.' }))
      return false
    }
  }

  return { ...state, saveProgram, clearSession }
}
