/**
 * The Interpreter ties together the lexer, parser, evaluator, turtle, and
 * virtual file system, and exposes a simple API for the UI.
 */

import { tokenize } from './lexer'
import { parse } from './parser'
import { Evaluator, type EvalContext } from './evaluator'
import { Environment } from './environment'
import { LogoError } from './errors'
import { registerAll } from './primitives'
import type { Turtle } from '../turtle/Turtle'
import type { VirtualFS } from '../filesystem/VirtualFS'
import { toLogoString } from './types'

/** Human-readable error text including the source location when known. */
export function formatError(e: LogoError): string {
  let where = ''
  if (e.line !== undefined) where += ` at line ${e.line}`
  if (e.procName) where += ` in ${e.procName}`
  return `Error: ${e.message}${where}`
}

export interface InterpreterOptions {
  turtle?: Turtle
  fs?: VirtualFS
  onOutput?: (text: string) => void
  /** Called by CT / CLEARTEXT. */
  onClearText?: () => void
  /** Line input for READ / READLIST / READWORD (undefined = no input). */
  readLine?: () => string | undefined
}

export class Interpreter {
  env: Environment
  evaluator: Evaluator
  turtle?: Turtle
  fs?: VirtualFS
  private onOutput?: (text: string) => void
  private options: InterpreterOptions

  constructor(options: InterpreterOptions = {}) {
    this.options = options
    this.env = Environment.global()
    this.turtle = options.turtle
    this.fs = options.fs
    this.onOutput = options.onOutput

    const ctx: EvalContext = {
      env: this.env,
      turtle: this.turtle,
      fs: this.fs,
      output: (s) => this.onOutput?.(s),
      stop: () => {},
      clearText: () => this.options.onClearText?.(),
      readLine: this.options.readLine,
    }
    this.evaluator = new Evaluator(ctx)
    registerAll(this.evaluator, ctx)
  }

  /** Last error raised by run(), or null if the last run succeeded. */
  lastError: LogoError | null = null

  /** Run a full Logo program. Returns the final value; errors are printed. */
  run(source: string): string {
    try {
      return this.runOrThrow(source)
    } catch (e) {
      if (e instanceof LogoError) {
        this.onOutput?.(`${formatError(e)}\n`)
        return ''
      }
      throw e
    }
  }

  /** Run a full Logo program, throwing LogoError on failure. */
  runOrThrow(source: string): string {
    this.lastError = null
    this.evaluator.steps = 0
    this.evaluator.abortRequested = false
    try {
      const tokens = tokenize(source)
      const ast = parse(tokens, this.evaluator)
      const result = this.evaluator.runProgram(ast, this.env)
      return toLogoString(result)
    } catch (e) {
      if (e instanceof LogoError) this.lastError = e
      throw e
    }
  }

  /** Request that the currently running program stop at the next step. */
  requestStop(): void {
    this.evaluator.abortRequested = true
  }

  /** Evaluate a single line (for the REPL). */
  evalLine(source: string): string {
    return this.run(source)
  }

  /** Print output (used by PRINT / SHOW / TYPE primitives). */
  print(text: string): void {
    this.onOutput?.(text)
  }

  /** Reset the interpreter state (clear procedures, variables, turtle). */
  reset(): void {
    this.env = Environment.global()
    Environment.clearProcs()
    Environment.clearProps()
    Environment.clearBuried()
    if (this.turtle) {
      this.turtle.home()
      this.turtle.clearScreen()
    }
    const ctx: EvalContext = {
      env: this.env,
      turtle: this.turtle,
      fs: this.fs,
      output: (s) => this.onOutput?.(s),
      stop: () => {},
      clearText: () => this.options.onClearText?.(),
      readLine: this.options.readLine,
    }
    this.evaluator = new Evaluator(ctx)
    registerAll(this.evaluator, ctx)
  }
}
