import type { LogoValue } from './types'

/**
 * Logo error types.
 *
 * UCBLogo reports errors with specific messages. We model them as a LogoError
 * carrying a message and, optionally, a Logo error number.
 */

export type LogoErrorCode =
  | 'NO_HOW' // I don't know how to X
  | 'NEED_MORE_INPUTS' // X needs more inputs
  | 'TOO_MANY_INPUTS' // X doesn't like Y as input
  | 'BAD_INPUT' // X doesn't like Y as input
  | 'NOT_PROCEDURE' // X is not a procedure
  | 'STOP' // STOP signal (not an error)
  | 'THROW' // THROW signal
  | 'OUTPUT' // OUTPUT signal
  | 'SYNTAX' // syntax error
  | 'FILE' // file error
  | 'DIV_ZERO' // division by zero
  | 'OUT_OF_BOUNDS' // index out of bounds
  | 'USER' // user error via THROW/ERROR

export class LogoError extends Error {
  code: LogoErrorCode
  logoNumber?: number

  constructor(message: string, code: LogoErrorCode = 'USER', logoNumber?: number) {
    super(message)
    this.name = 'LogoError'
    this.code = code
    this.logoNumber = logoNumber
  }
}

/** Thrown to signal STOP (exit a procedure without a value). */
export class StopSignal extends Error {
  constructor() {
    super('STOP')
    this.name = 'StopSignal'
  }
}

/** Thrown to signal OUTPUT (return a value from a procedure). */
export class OutputSignal extends Error {
  value: LogoValue
  constructor(value: LogoValue) {
    super('OUTPUT')
    this.name = 'OutputSignal'
    this.value = value
  }
}

/** Thrown to signal THROW (non-local exit to a CATCH). */
export class ThrowSignal extends Error {
  tag: string
  value: LogoValue
  constructor(tag: string, value: LogoValue) {
    super('THROW')
    this.name = 'ThrowSignal'
    this.tag = tag
    this.value = value
  }
}

/** Helper to build "I don't know how to X" errors. */
export function noHow(name: string): LogoError {
  return new LogoError(`I don't know how to ${name}`, 'NO_HOW')
}

/** Helper to build "X needs more inputs" errors. */
export function needMoreInputs(name: string): LogoError {
  return new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS')
}

/** Helper to build "X doesn't like Y as input" errors. */
export function badInput(name: string, value: unknown): LogoError {
  const rendered = typeof value === 'string' ? value : String(value)
  return new LogoError(`${name} doesn't like ${rendered} as input`, 'BAD_INPUT')
}
