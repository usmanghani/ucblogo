import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROGRAM_SESSION_KEY, useProgramSession } from '../src/session/useProgramSession'

beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('program session persistence', () => {
  it('starts with the example only when there is no saved program', () => {
    const { result } = renderHook(() => useProgramSession('FD 10'))
    expect(result.current.program).toBe('FD 10')
    expect(sessionStorage.getItem(PROGRAM_SESSION_KEY)).toBeNull()
  })
  it('restores saved source exactly, including comments and Unicode', () => {
    const program = '; café\nTO FARM\n FD 12\nEND\n'
    sessionStorage.setItem(PROGRAM_SESSION_KEY, program)
    expect(renderHook(() => useProgramSession('EXAMPLE')).result.current.program).toBe(program)
  })
  it('saves every edit and restores it after remount', () => {
    const hook = renderHook(() => useProgramSession('EXAMPLE'))
    act(() => hook.result.current.saveProgram('REPEAT 4 [FD 50 RT 90]'))
    hook.unmount()
    const fresh = renderHook(() => useProgramSession('EXAMPLE'))
    expect(fresh.result.current.program).toBe('REPEAT 4 [FD 50 RT 90]')
  })
  it('preserves an intentionally empty program', () => {
    sessionStorage.setItem(PROGRAM_SESSION_KEY, '')
    expect(renderHook(() => useProgramSession('EXAMPLE')).result.current.program).toBe('')
  })
  it('clears the editor and removes only its own storage entry', () => {
    sessionStorage.setItem('other-app', 'keep')
    sessionStorage.setItem(PROGRAM_SESSION_KEY, 'OLD PROGRAM')
    const hook = renderHook(() => useProgramSession('EXAMPLE'))
    act(() => { expect(hook.result.current.clearSession()).toBe(true) })
    expect(hook.result.current.program).toBe('')
    expect(sessionStorage.getItem(PROGRAM_SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem('other-app')).toBe('keep')
  })
  it('does not resurrect cleared source after remount', () => {
    sessionStorage.setItem(PROGRAM_SESSION_KEY, 'OLD PROGRAM')
    const hook = renderHook(() => useProgramSession('EXAMPLE'))
    act(() => { hook.result.current.clearSession() })
    hook.unmount()
    expect(renderHook(() => useProgramSession('EXAMPLE')).result.current.program).toBe('EXAMPLE')
  })
  it('allows editing and reports storage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const hook = renderHook(() => useProgramSession('EXAMPLE'))
    act(() => hook.result.current.saveProgram('FD 20'))
    expect(hook.result.current.program).toBe('FD 20')
    expect(hook.result.current.error).toContain('Could not save')
  })
  it('keeps current text if clearing storage fails', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    const hook = renderHook(() => useProgramSession('FD 30'))
    act(() => { expect(hook.result.current.clearSession()).toBe(false) })
    expect(hook.result.current.program).toBe('FD 30')
    expect(hook.result.current.error).toContain('Could not clear')
  })
  it('falls back gracefully when reading storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const hook = renderHook(() => useProgramSession('EXAMPLE'))
    expect(hook.result.current.program).toBe('EXAMPLE')
    expect(hook.result.current.error).toContain('unavailable')
  })
})
