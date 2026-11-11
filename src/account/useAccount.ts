import { useCallback, useEffect, useMemo, useState } from 'react'
import { accountApi, type AccountUser } from './api'

/**
 * Who is using the classroom. Everyone starts anonymous, and stays that way on a site
 * with no accounts configured: `available` is then false and the page never mentions them.
 */
export function useAccount() {
  const [state, setState] = useState<{ available: boolean; user: AccountUser | null; ready: boolean }>({ available: false, user: null, ready: false })

  useEffect(() => {
    let current = true
    accountApi.me()
      .then(me => { if (current) setState({ available: me.accounts, user: me.user, ready: true }) })
      .catch(() => { if (current) setState({ available: false, user: null, ready: true }) })
    return () => { current = false }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await accountApi.signIn(email, password)
    setState(previous => ({ ...previous, user }))
  }, [])
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await accountApi.signUp(name, email, password)
    setState(previous => ({ ...previous, user }))
  }, [])
  const signOut = useCallback(async () => {
    await accountApi.signOut()
    setState(previous => ({ ...previous, user: null }))
  }, [])

  return useMemo(() => ({ ...state, signIn, signUp, signOut }), [state, signIn, signUp, signOut])
}

export type Account = ReturnType<typeof useAccount>
