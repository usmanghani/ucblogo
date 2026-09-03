/**
 * The Logo block generator: build workspaces headless, emit Logo, and run the
 * emitted code through the real interpreter.
 */
import { describe, it, expect } from 'vitest'
import * as Blockly from 'blockly'
import { workspaceToLogo, LogoGenerator } from '../src/blocks/logoGenerator'
import { defineLogoBlocks, STARTER_WORKSPACE } from '../src/blocks/logoBlocks'
import { encodeLgb, decodeLgb, isLgb } from '../src/blocks/lgbFormat'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

defineLogoBlocks()

function load(state: unknown): Blockly.Workspace {
  const ws = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state as { [key: string]: unknown }, ws)
  return ws
}

function run(code: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const turtle = new Turtle(canvas)
  const out: string[] = []
  const interp = new Interpreter({ turtle, onOutput: (s) => out.push(s) })
  interp.runOrThrow(code)
  return { turtle, output: out.join('') }
}

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } })

describe('Logo block generator', () => {
  it('emits a square from repeat + move + turn', () => {
    const ws = load({
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'controls_repeat_ext',
            inputs: {
              TIMES: num(4),
              DO: {
                block: {
                  type: 'logo_move',
                  fields: { DIR: 'FORWARD' },
                  inputs: { DISTANCE: num(100) },
                  next: { block: { type: 'logo_turn', fields: { DIR: 'RIGHT' }, inputs: { ANGLE: num(90) } } },
                },
              },
            },
          },
        ],
      },
    })
    const code = workspaceToLogo(ws)
    expect(code).toBe('REPEAT 4 [\n  FORWARD 100\n  RIGHT 90\n]\n')
    const { turtle } = run(code)
    expect(turtle.getState().heading).toBe(0)
    expect(turtle.getState().x).toBeCloseTo(0)
  })

  it('generates procedures with parameters and calls them', () => {
    const ws = load({
      variables: [{ name: 'size', id: 'v1' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'procedures_defnoreturn',
            extraState: { params: [{ name: 'size', id: 'v1' }] },
            fields: { NAME: 'draw square' },
            inputs: {
              STACK: {
                block: {
                  type: 'controls_repeat_ext',
                  inputs: {
                    TIMES: num(4),
                    DO: {
                      block: {
                        type: 'logo_move',
                        fields: { DIR: 'FORWARD' },
                        inputs: { DISTANCE: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } } },
                        next: { block: { type: 'logo_turn', fields: { DIR: 'RIGHT' }, inputs: { ANGLE: num(90) } } },
                      },
                    },
                  },
                },
              },
            },
          },
          {
            type: 'procedures_callnoreturn',
            extraState: { name: 'draw square', params: ['size'] },
            inputs: { ARG0: num(50) },
          },
        ],
      },
    })
    const code = workspaceToLogo(ws)
    expect(code).toContain('TO DRAW_SQUARE :SIZE')
    expect(code).toContain('FORWARD :SIZE')
    expect(code.trim().endsWith('DRAW_SQUARE 50')).toBe(true)
    const { turtle } = run(code)
    expect(turtle.getState().x).toBeCloseTo(0)
    expect(turtle.getState().y).toBeCloseTo(0)
  })

  it('generates if/else-if/else chains, comparisons and printing', () => {
    const ws = load({
      variables: [{ name: 'n', id: 'n' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'variables_set',
            fields: { VAR: { id: 'n' } },
            inputs: { VALUE: num(7) },
            next: {
              block: {
                type: 'controls_if',
                extraState: { elseIfCount: 1, hasElse: true },
                inputs: {
                  IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { id: 'n' } } } }, B: num(5) } } },
                  DO0: { block: { type: 'logo_print', fields: { MODE: 'PRINT' }, inputs: { VALUE: { block: { type: 'logo_word', fields: { TEXT: 'small' } } } } } },
                  IF1: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { id: 'n' } } } }, B: num(10) } } },
                  DO1: { block: { type: 'logo_print', fields: { MODE: 'PRINT' }, inputs: { VALUE: { block: { type: 'logo_word', fields: { TEXT: 'medium' } } } } } },
                  ELSE: { block: { type: 'logo_print', fields: { MODE: 'PRINT' }, inputs: { VALUE: { block: { type: 'logo_word', fields: { TEXT: 'large' } } } } } },
                },
              },
            },
          },
        ],
      },
    })
    const code = workspaceToLogo(ws)
    expect(code).toContain('MAKE "N 7')
    expect(code).toContain('IFELSE (:N < 5)')
    const { output } = run(code)
    expect(output).toBe('medium\n')
  })

  it('quotes words with spaces and builds lists', () => {
    const ws = load({
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'logo_print',
            fields: { MODE: 'SHOW' },
            inputs: {
              VALUE: {
                block: {
                  type: 'lists_create_with',
                  extraState: { itemCount: 2 },
                  inputs: { ADD0: { block: { type: 'text', fields: { TEXT: 'hello world' } } }, ADD1: num(3) },
                },
              },
            },
          },
        ],
      },
    })
    const code = workspaceToLogo(ws)
    expect(code).toBe('SHOW (LIST "|hello world| 3)\n')
    expect(run(code).output).toBe('[hello world 3]\n')
  })

  it('renders the starter program and it runs', () => {
    const code = workspaceToLogo(load(STARTER_WORKSPACE))
    expect(code).toContain('REPEAT 36 [')
    const { turtle } = run(code)
    expect(turtle.getState().penSize).toBe(2)
  })

  it('sanitizes identifiers', () => {
    expect(LogoGenerator.ident('my proc!')).toBe('MY_PROC')
    expect(LogoGenerator.quote('a b')).toBe('"|a b|')
    expect(LogoGenerator.quote('')).toBe('"||')
  })
})

describe('.lgb file format', () => {
  it('round-trips code and workspace, and the file runs as plain Logo', () => {
    const ws = load(STARTER_WORKSPACE)
    const code = workspaceToLogo(ws)
    const state = Blockly.serialization.workspaces.save(ws)
    const text = encodeLgb(code, state)
    expect(isLgb(text)).toBe(true)
    const decoded = decodeLgb(text)
    expect(decoded.code.trim()).toBe(code.trim())
    expect(decoded.workspace).toEqual(state)
    // The trailer is comments: the whole file is runnable Logo.
    const { turtle } = run(text)
    expect(turtle.getState().penSize).toBe(2)
  })

  it('treats plain Logo as code without a workspace', () => {
    const d = decodeLgb('FD 10\n')
    expect(d.workspace).toBeNull()
    expect(d.code).toBe('FD 10\n')
  })
})
