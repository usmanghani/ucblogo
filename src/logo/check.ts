import { Interpreter } from '../interpreter/interpreter'
import { Environment } from '../interpreter/environment'
import type { LogoError } from '../interpreter/errors'
import { Turtle, createNullCanvas, type DrawingSummary } from '../turtle/Turtle'

export const MAX_PROGRAM_CHARS = 30_000
const MAX_OUTPUT_CHARS = 4_000

/** The facts about one run of a Logo program, small enough to hand to the model. */
export interface ProgramCheck {
  ok: boolean
  output: string
  errors: Array<{ message: string; line?: number }>
  turtle: { x: number; y: number; heading: number; penDown: boolean; visible: boolean }
  drawing: DrawingSummary
}

/**
 * Run a program from a clean slate with no screen and no clock, and report what happened.
 * It is synchronous on purpose: procedure definitions live in module state, so a run must
 * not interleave with another one on the same server instance.
 */
export function checkProgram(code: string, timeLimitMs = 2000): ProgramCheck {
  Environment.clearProcs()
  Environment.clearProps()
  Environment.clearBuried()
  const turtle = new Turtle(createNullCanvas())
  let output = ''
  const errors: ProgramCheck['errors'] = []
  const interpreter = new Interpreter({
    turtle,
    onOutput: text => { if (output.length < MAX_OUTPUT_CHARS) output = (output + text).slice(0, MAX_OUTPUT_CHARS) },
    onError: error => {
      const line = (error as LogoError).location?.line
      errors.push({ message: error.message === 'Execution limit exceeded'
        ? 'The program ran too long and was stopped. Look for a loop or recursion that never ends.'
        : error.message, ...(line ? { line } : {}) })
    },
  })
  interpreter.runHeadless(code, timeLimitMs)
  const state = turtle.getState()
  const round = (n: number) => Math.round(n * 10) / 10 + 0 // + 0 turns -0 into 0
  return {
    ok: errors.length === 0,
    output: output.trimEnd(),
    errors,
    turtle: { x: round(state.x), y: round(state.y), heading: round(state.heading), penDown: state.penDown, visible: state.visible },
    drawing: turtle.getDrawingSummary(),
  }
}
