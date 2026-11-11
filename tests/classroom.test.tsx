import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import App from '../src/App'
import type { TeacherHandlers } from '../src/teacher/useTeacher'

// The page around a stubbed Pip: what the classroom does when the teacher's tools fire,
// and what it tells the teacher about the student's work.
const state = vi.hoisted(() => ({ code: 'PRINT 111', handlers: null as TeacherHandlers | null, sent: [] as string[] }))
vi.mock('../src/filesystem/VirtualFS', () => ({ VirtualFS: class { initialize() {} } }))
vi.mock('../src/components/Editor', () => ({
  Editor: forwardRef(function MockEditor(_props, ref) {
    useImperativeHandle(ref, () => ({ getValue: () => state.code, setValue: (code: string) => { state.code = code }, clearErrors() {}, showError() {} }))
    return <div>Code editor</div>
  }),
}))
vi.mock('../src/components/TurtleCanvas', () => ({
  TurtleCanvas: ({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) => {
    useEffect(() => { onReady(document.createElement('canvas')) }, [onReady])
    return null
  },
}))
vi.mock('../src/teacher/useTeacher', async original => ({
  ...await original<typeof import('../src/teacher/useTeacher')>(),
  useTeacher: (handlers: TeacherHandlers) => {
    state.handlers = handlers
    return { messages: [], drawings: new Map(), working: false, resuming: false, failure: null, send: async (text: string) => { state.sent.push(text) }, stop: async () => {}, newChat() {} }
  },
}))

beforeEach(() => { localStorage.clear(); localStorage.setItem('logo-teacher.consent.v1', 'yes'); state.code = 'PRINT 111'; state.sent = [] })
afterEach(cleanup)
const log = () => screen.getByRole('log').textContent

it('runs the student’s program and tells Pip what happened', async () => {
  render(<App />)
  expect(state.handlers!.getPage()).toMatchObject({ program: 'PRINT 111', lastRun: null, lesson: null, completed: [] })
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  await waitFor(() => expect(log()).toBe('111'))
  await waitFor(() => expect(state.handlers!.getPage().lastRun).toEqual({ by: 'student', current: true, output: '111\n', errors: [], stopped: false }))
  state.code = 'PRINT 222'
  expect(state.handlers!.getPage().lastRun).toMatchObject({ current: false })
})

it('puts Pip’s program in the code pane, runs it, and can undo it', async () => {
  render(<App />)
  act(() => state.handlers!.onProgram('PRINT 333'))
  await waitFor(() => expect(log()).toBe('333'))
  expect(state.code).toBe('PRINT 333')
  await waitFor(() => expect(state.handlers!.getPage().lastRun).toMatchObject({ by: 'pip', current: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Undo change' }))
  expect(state.code).toBe('PRINT 111')
  expect(screen.queryByRole('button', { name: 'Undo change' })).toBeNull()
})

it('does not undo over edits the student made afterwards', async () => {
  render(<App />)
  act(() => state.handlers!.onProgram('PRINT 333'))
  await waitFor(() => expect(log()).toBe('333'))
  state.code = 'PRINT 333 PRINT 444'
  fireEvent.click(screen.getByRole('button', { name: 'Undo change' }))
  expect(state.code).toBe('PRINT 333 PRINT 444')
})

it('offers Pip’s help once when the student’s own run fails', async () => {
  state.code = 'FDD 50'
  render(<App />)
  expect(screen.queryByText('Ask Pip')).toBeNull()
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  fireEvent.click(await screen.findByRole('button', { name: /Your program stopped.*Ask Pip/ }))
  expect(state.sent[0]).toContain("I don't know how to FDD")
  expect(state.handlers!.getPage().lastRun).toMatchObject({ by: 'student', errors: ["I don't know how to FDD"] })
})

it('records a finished lesson and reports it back to Pip', async () => {
  render(<App />)
  act(() => state.handlers!.onLessonComplete('meet-the-turtle'))
  await waitFor(() => expect(screen.getByRole('button', { name: /Lessons/ })).toHaveTextContent('1/8'))
  expect(state.handlers!.getPage().completed).toEqual(['meet-the-turtle'])
})
