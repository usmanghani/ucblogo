// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkProgram } from '../src/logo/check'
import { lessons } from '../src/teacher/lessons'

describe('checkProgram: how Pip finds out what a program does', () => {
  it('runs with no canvas and reports output, turtle and drawing', () => {
    const check = checkProgram('CS SETPC 4 REPEAT 4 [FD 80 RT 90] PRINT [DONE] HT')
    expect(check).toMatchObject({ ok: true, output: 'DONE', errors: [], turtle: { x: 0, y: 0, heading: 0, visible: false } })
    expect(check.drawing).toEqual({ strokes: 4, bounds: { left: 0, right: 80, bottom: 0, top: 80 }, penColors: [4] })
  })
  it('reports the line of a mistake and keeps what was drawn before it', () => {
    const check = checkProgram('TO sq :n\n  REPEAT 4 [FD :n RT 90]\nEND\nsq 50\nfoo 3')
    expect(check.ok).toBe(false)
    expect(check.errors).toEqual([{ message: "I don't know how to FOO", line: 5 }])
    expect(check.drawing.strokes).toBe(4)
  })
  it('reports syntax errors', () => {
    expect(checkProgram('REPEAT 4 [FD 50 RT 90').errors[0].message).toMatch(/Unclosed/)
  })
  it('stops a program that never ends and says why in plain words', () => {
    const started = Date.now()
    const check = checkProgram('FOREVER [FD 1 RT 1]')
    expect(check.ok).toBe(false)
    expect(check.errors[0].message).toMatch(/ran too long/)
    expect(Date.now() - started).toBeLessThan(3000)
  })
  it('treats WAIT as instant so animations can be checked', () => {
    expect(checkProgram('REPEAT 3 [FD 10 WAIT 60] PRINT "ok')).toMatchObject({ ok: true, output: 'ok' })
  })
  it('starts every run from a clean slate', () => {
    checkProgram('TO leftover\n PRINT "stale\nEND\nMAKE "x 5')
    const check = checkProgram('leftover')
    expect(check.errors[0].message).toMatch(/don't know how to LEFTOVER/i)
    expect(checkProgram('PRINT :x').ok).toBe(false)
  })
  it('bounds the output it returns', () => {
    expect(checkProgram('REPEAT 5000 [PRINT [HELLO HELLO HELLO]]').output.length).toBeLessThanOrEqual(4000)
  })
  it('measures arcs, labels and an empty drawing', () => {
    expect(checkProgram('PU FD 50').drawing).toEqual({ strokes: 0, bounds: null, penColors: [] })
    expect(checkProgram('ARC 360 40').drawing.bounds).toEqual({ left: -40, right: 40, bottom: -40, top: 40 })
  })
})

describe('the course', () => {
  it('has unique lesson ids', () => {
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length)
  })
  it.each(lessons.map(lesson => [lesson.title, lesson] as const))('starter for "%s" runs cleanly and draws', (_title, lesson) => {
    const check = checkProgram(lesson.starter)
    expect(check.errors).toEqual([])
    expect(check.drawing.strokes).toBeGreaterThan(0)
    const { left, right, bottom, top } = check.drawing.bounds!
    expect(Math.max(-left, right, -bottom, top)).toBeLessThanOrEqual(320)
  })
})
