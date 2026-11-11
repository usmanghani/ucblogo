import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EveMessage } from 'eve/react'
import { Markdown, parseBlocks } from '../src/teacher/Markdown'
import { LessonPath, toThreadMessage } from '../src/teacher/TeacherPanel'
import { lessons } from '../src/teacher/lessons'
import { PROGRESS_KEY, useConsent, useProgress } from '../src/teacher/progress'
import { describeError } from '../src/teacher/useTeacher'
import { drawingAttachments, fitInside } from '../src/teacher/drawing'
import { act, renderHook } from '@testing-library/react'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Pip’s replies', () => {
  it('splits prose, lists and code', () => {
    expect(parseBlocks('Try this:\n\n```logo\nFD 100\nRT 90\n```\n\n- one\n- two\n\n1. first')).toEqual([
      { kind: 'paragraph', text: 'Try this:' },
      { kind: 'code', text: 'FD 100\nRT 90', closed: true },
      { kind: 'list', ordered: false, items: ['one', 'two'] },
      { kind: 'list', ordered: true, items: ['first'] },
    ])
  })
  it('offers "Try it" only once a code block has finished streaming', () => {
    const onTry = vi.fn()
    const view = render(<Markdown text={'Look:\n```\nFD 10'} onTry={onTry} />)
    expect(screen.queryByRole('button', { name: 'Try it' })).toBeNull()
    view.rerender(<Markdown text={'Look:\n```\nFD 10\n```'} onTry={onTry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }))
    expect(onTry).toHaveBeenCalledWith('FD 10')
  })
  it('renders inline code and emphasis as text, never as HTML', () => {
    const { container } = render(<Markdown text={'Use `FD 50` and **turn** <img src=x onerror=alert(1)>'} />)
    expect(container.querySelector('code')?.textContent).toBe('FD 50')
    expect(container.querySelector('strong')?.textContent).toBe('turn')
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('eve messages on assistant-ui', () => {
  const message = (parts: unknown[]): EveMessage => ({ id: 'm1', role: 'assistant', parts } as unknown as EveMessage)
  it('keeps text and tool calls, and hides reasoning', () => {
    const converted = toThreadMessage(message([
      { type: 'reasoning', text: 'private thoughts' },
      { type: 'text', text: 'Here is a square.' },
      { type: 'tool', callId: 'c1', name: 'write_program', state: 'completed', input: { code: 'FD 1' }, output: { ok: true } },
    ]))
    expect(converted).toEqual({ id: 'm1', role: 'assistant', content: [
      { type: 'text', text: 'Here is a square.' },
      { type: 'tool-call', toolCallId: 'c1', toolName: 'write_program', args: { code: 'FD 1' }, result: { ok: true }, isError: false },
    ] })
  })
  it('shows a call as in progress until it settles, and as a problem when it fails', () => {
    const [running] = toThreadMessage(message([{ type: 'tool', callId: 'c1', name: 'test_program', state: 'running', input: {} }])).content as Array<Record<string, unknown>>
    expect(running).not.toHaveProperty('result')
    const [failed] = toThreadMessage(message([{ type: 'tool', callId: 'c1', name: 'test_program', state: 'failed' }])).content as Array<Record<string, unknown>>
    expect(failed).toMatchObject({ isError: true })
  })
})

describe('drawings', () => {
  it('shrinks big photos and leaves small pictures alone', () => {
    expect(fitInside(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(fitInside(3000, 4000)).toEqual({ width: 960, height: 1280 })
    expect(fitInside(300, 200)).toEqual({ width: 300, height: 200 })
  })
  it('accepts only pictures and holds one until the message is sent', async () => {
    expect(drawingAttachments.accept).toBe('image/jpeg,image/png,image/webp,image/gif')
    const pending = await drawingAttachments.add({ file: new File(['x'], 'house.png', { type: 'image/png' }) })
    expect(pending).toMatchObject({ type: 'image', name: 'house.png', status: { type: 'requires-action', reason: 'composer-send' } })
  })
  it('keeps a sent picture in the conversation as an image part', () => {
    const sent = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'my drawing' }, { type: 'file', mediaType: 'image/jpeg' }] } as unknown as EveMessage
    expect(toThreadMessage(sent).content).toEqual([{ type: 'text', text: 'my drawing' }, { type: 'image', image: '' }])
  })
})

describe('lessons and progress', () => {
  it('lists the course in order and marks finished and open lessons', () => {
    const onPick = vi.fn()
    render(<LessonPath completed={[lessons[0].id]} current={lessons[1].id} onPick={onPick} />)
    const steps = screen.getAllByRole('button')
    expect(steps).toHaveLength(lessons.length)
    expect(steps[0]).toHaveTextContent('finished')
    expect(steps[1].className).toContain('is-current')
    fireEvent.click(steps[2])
    expect(onPick).toHaveBeenCalledWith(lessons[2])
  })
  it('remembers finished lessons in this browser and ignores unknown ids', () => {
    const hook = renderHook(() => useProgress())
    act(() => { hook.result.current.complete('repeat'); hook.result.current.complete('repeat'); hook.result.current.complete('made-up') })
    expect(hook.result.current.completed).toEqual(['repeat'])
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual(['repeat'])
    expect(renderHook(() => useProgress()).result.current.completed).toEqual(['repeat'])
  })
  it('survives corrupt saved progress', () => {
    localStorage.setItem(PROGRESS_KEY, '{not json')
    expect(renderHook(() => useProgress()).result.current.completed).toEqual([])
  })
  it('asks for consent once per browser', () => {
    const hook = renderHook(() => useConsent())
    expect(hook.result.current.consent).toBe(false)
    act(() => hook.result.current.accept())
    expect(hook.result.current.consent).toBe(true)
    expect(renderHook(() => useConsent()).result.current.consent).toBe(true)
  })
})

describe('failures in plain words', () => {
  it.each([
    [new Error('Failed to fetch'), /Check your connection/],
    [new Error('Pip is helping a lot of students right now. Wait a minute, then try again.'), /Wait a minute/],
    [new Error('AI Gateway received no credentials.'), /could not reach its AI model/],
    [new Error('Server returned 403.'), /not available on this site/],
    [new Error('Server returned 413.'), /smaller photo/],
    [undefined, /ran into a problem/],
  ])('%s', (error, expected) => { expect(describeError(error)).toMatch(expected) })
})
