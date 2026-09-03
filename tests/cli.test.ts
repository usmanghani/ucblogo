/**
 * The command-line renderer: software canvas + terminal output, and running
 * `.lgb` block files as plain Logo.
 */
import { describe, it, expect } from 'vitest'
import { SoftwareCanvas } from '../src/cli/SoftwareCanvas'
import { renderCanvas, stripAnsi } from '../src/cli/terminal'
import { Turtle } from '../src/turtle/Turtle'
import { Interpreter } from '../src/interpreter/interpreter'
import { colorToRgb } from '../src/turtle/colors'
import { encodeLgb } from '../src/blocks/lgbFormat'

function session(w = 200, h = 200) {
  const display = new SoftwareCanvas(w, h)
  const turtle = new Turtle(display, { createCanvas: (cw, ch) => new SoftwareCanvas(cw, ch) })
  const out: string[] = []
  const interp = new Interpreter({ turtle, onOutput: (s) => out.push(s) })
  return { display, turtle, interp, out }
}

describe('software canvas', () => {
  it('starts filled with the background colour and draws lines', () => {
    const { display, interp } = session()
    expect(display.pixel(10, 10)).toEqual([255, 255, 255])
    interp.runOrThrow('HT SETPC 4 FD 50')
    // The line goes up from the centre (100,100) to (100,50).
    expect(display.pixel(100, 75)).toEqual([255, 0, 0])
    expect(display.pixel(150, 75)).toEqual([255, 255, 255])
  })

  it('fills stamped shapes', () => {
    const { display, interp } = session()
    interp.runOrThrow('HT SETPC 1 (STAMPRECT 40 40 "TRUE)')
    expect(display.pixel(100, 100)).toEqual([0, 0, 255])
    expect(display.pixel(100, 60)).toEqual([255, 255, 255])
  })
})

describe('terminal renderer', () => {
  it('renders a square as braille dots on a blank background', () => {
    const { display, interp, turtle } = session(120, 120)
    interp.runOrThrow('HT REPEAT 4 [FD 40 RT 90]')
    const lines = renderCanvas(display, { columns: 30, rows: 15, mode: 'braille', background: colorToRgb(turtle.getState().background) })
    expect(lines).toHaveLength(15)
    const text = lines.join('\n')
    expect(text).toMatch(/[⠁-⣿]/) // some dots set
    expect(lines[0]).toBe('⠀'.repeat(30)) // top row empty
  })

  it('renders colour blocks with ANSI sequences and can strip them', () => {
    const { display, interp, turtle } = session(80, 80)
    interp.runOrThrow('HT SETPC 4 SETPENSIZE 6 FD 30')
    const lines = renderCanvas(display, { columns: 20, rows: 10, mode: 'color', background: colorToRgb(turtle.getState().background) })
    const joined = lines.join('\n')
    expect(joined).toContain('\x1b[38;2;255;0;0m')
    expect(stripAnsi(joined)).toMatch(/[▀▄]/)
  })

  it('overlays LABEL text', () => {
    const { display, interp, turtle } = session(200, 100)
    interp.runOrThrow('HT LABEL "Hi')
    const lines = renderCanvas(display, { columns: 40, rows: 10, mode: 'braille', background: colorToRgb(turtle.getState().background) })
    expect(lines.join('\n')).toContain('Hi')
  })
})

describe('.lgb files on the command line', () => {
  it('runs the Logo part and ignores the blocks trailer', () => {
    const text = encodeLgb('HT\nREPEAT 4 [\n  FORWARD 40\n  RIGHT 90\n]\nPRINT "done\n', { blocks: { languageVersion: 0, blocks: [] } })
    const { interp, out, turtle } = session()
    interp.runOrThrow(text)
    expect(out.join('')).toBe('done\n')
    expect(turtle.getState().heading).toBe(0)
  })
})
