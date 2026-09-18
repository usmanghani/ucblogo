import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import App from '../src/App'

const state = vi.hoisted(() => ({ blockCode: 'PRINT 222', error: false }))
vi.mock('../src/filesystem/VirtualFS', () => ({ VirtualFS: class { initialize() {} } }))
vi.mock('../src/components/Editor', () => ({
  Editor: forwardRef(function MockEditor(_props, ref) {
    useImperativeHandle(ref, () => ({ getValue: () => 'PRINT 111', clearErrors() {}, showError() {} }))
    return <div>Text workspace</div>
  }),
}))
vi.mock('../src/components/Blocks', () => ({
  Blocks: forwardRef(function MockBlocks({ onRun }: { onRun: () => void }, ref) {
    useImperativeHandle(ref, () => ({ getCode: () => {
      if (state.error) throw new Error('Connect a value to count')
      return state.blockCode
    } }))
    return <button onClick={onRun}>Run blocks</button>
  }),
}))
vi.mock('../src/components/TurtleCanvas', () => ({
  TurtleCanvas: ({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) => {
    useEffect(() => { onReady(document.createElement('canvas')) }, [onReady])
    return null
  },
}))
afterEach(() => { cleanup(); state.error = false; state.blockCode = 'PRINT 222' })

it('runs the selected workspace through the toolbar and local blocks button', () => {
  render(<App />)
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  expect(screen.getByRole('log').textContent).toBe('111')
  fireEvent.click(screen.getByText('Blocks editor'))
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  expect(screen.getByRole('log').textContent).toBe('222')
  state.blockCode = 'PRINT 333'
  fireEvent.click(screen.getByText('Run blocks'))
  expect(screen.getByRole('log').textContent).toBe('333')
  fireEvent.click(screen.getByText('Text editor'))
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  expect(screen.getByRole('log').textContent).toBe('111')
})

it('reports invalid blocks without falling back to the text program', () => {
  render(<App />)
  fireEvent.click(screen.getByText('Blocks editor'))
  state.error = true
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  expect(screen.getByRole('log').textContent).toBe('Connect a value to count')
})
