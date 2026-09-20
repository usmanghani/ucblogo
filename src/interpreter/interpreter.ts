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

export interface InterpreterOptions {
  turtle?: Turtle
  fs?: VirtualFS
  onOutput?: (text: string) => void
  onError?: (error: LogoError | Error) => void
}

export class Interpreter {
  env: Environment
  evaluator: Evaluator
  turtle?: Turtle
  fs?: VirtualFS
  private onOutput?: (text: string) => void
  private onError?: (error: LogoError | Error) => void

  constructor(options: InterpreterOptions = {}) {
    this.env = Environment.global()
    this.turtle = options.turtle
    this.fs = options.fs
    this.onOutput = options.onOutput
    this.onError = options.onError

    const ctx: EvalContext = {
      env: this.env,
      turtle: this.turtle,
      fs: this.fs,
      output: (s) => this.onOutput?.(s),
      stop: () => {},
    }
    this.evaluator = new Evaluator(ctx)
    registerAll(this.evaluator, ctx)
  }

  /** Run a full Logo program. Returns the final value. */
  run(source: string): string {
    try {
      const tokens = tokenize(source)
      const ast = parse(tokens, this.evaluator)
      const result = this.evaluator.runProgram(ast, this.env)
      return toLogoString(result)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      this.onError?.(error)
      if (!this.onError && error instanceof LogoError) this.onOutput?.(`${error.message}\n`)
      return ''
    }
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
    }
    this.evaluator = new Evaluator(ctx)
    registerAll(this.evaluator, ctx)
  }
}
