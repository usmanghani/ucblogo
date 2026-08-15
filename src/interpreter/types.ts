/**
 * Core Logo value types.
 *
 * A Logo value is one of:
 *   - number  (integer or float)
 *   - string  (a Logo "word")
 *   - boolean (TRUE / FALSE)
 *   - LogoList   (a Logo list, delimited by [ ])
 *   - LogoArray  (a mutable array, delimited by { })
 *   - null    (the empty word / no value)
 */

export type LogoValue = number | string | boolean | LogoList | LogoArray | null

/** A Logo list is an immutable sequence of Logo values. */
export class LogoList {
  readonly items: LogoValue[]

  constructor(items: LogoValue[] = []) {
    this.items = items
  }

  get length(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  /** Convert to a plain JS array (shallow). */
  toArray(): LogoValue[] {
    return this.items.slice()
  }

  equals(other: LogoList): boolean {
    if (this.items.length !== other.items.length) return false
    for (let i = 0; i < this.items.length; i++) {
      if (!logoEqual(this.items[i], other.items[i])) return false
    }
    return true
  }
}

/** A Logo array is a mutable, origin-indexed sequence. */
export class LogoArray {
  readonly items: LogoValue[]
  readonly origin: number

  constructor(size: number, origin = 1, initial: LogoValue = '') {
    this.items = new Array(size).fill(initial)
    this.origin = origin
  }

  get length(): number {
    return this.items.length
  }

  get(index: number): LogoValue {
    const i = index - this.origin
    if (i < 0 || i >= this.items.length) {
      throw new Error(`array index ${index} out of bounds`)
    }
    return this.items[i]
  }

  set(index: number, value: LogoValue): void {
    const i = index - this.origin
    if (i < 0 || i >= this.items.length) {
      throw new Error(`array index ${index} out of bounds`)
    }
    this.items[i] = value
  }

  toList(): LogoList {
    return new LogoList(this.items.slice())
  }
}

/** A user-defined Logo procedure. */
export interface LogoProc {
  name: string
  params: string[]
  body: unknown[] // parsed AST instruction nodes
  isMacro: boolean
  text?: string // original source text (for PO / TEXT)
}

/** A built-in primitive procedure. */
export interface LogoPrimitive {
  name: string
  minArgs: number
  maxArgs: number
  fn: (args: LogoValue[], ctx: EvalContext) => LogoValue
  isInfix?: boolean
  precedence?: number
  isSpecial?: boolean // handled specially by the evaluator (IF, REPEAT, ...)
}

/** Context passed to primitive functions. */
export interface EvalContext {
  // Set by the evaluator for primitives that need it.
  env: unknown
  turtle?: unknown
  fs?: unknown
  output: (s: string) => void
}

// ---------------------------------------------------------------------------
// Type predicates
// ---------------------------------------------------------------------------

export function isNumber(v: LogoValue): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function isWord(v: LogoValue): v is string {
  return typeof v === 'string'
}

export function isBoolean(v: LogoValue): v is boolean {
  return typeof v === 'boolean'
}

export function isList(v: LogoValue): v is LogoList {
  return v instanceof LogoList
}

export function isArray(v: LogoValue): v is LogoArray {
  return v instanceof LogoArray
}

export function isNull(v: LogoValue): v is null {
  return v === null
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

/** Logo equality: numbers compare numerically, words by string, lists elementwise. */
export function logoEqual(a: LogoValue, b: LogoValue): boolean {
  if (a === null || b === null) return a === b
  if (isNumber(a) && isNumber(b)) return a === b
  if (isWord(a) && isWord(b)) return a === b
  if (isBoolean(a) && isBoolean(b)) return a === b
  if (isList(a) && isList(b)) return a.equals(b)
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!logoEqual(a.items[i], b.items[i])) return false
    }
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Conversion to Logo string form
// ---------------------------------------------------------------------------

/** Render a Logo value in its printed form (as PRINT would show it). */
export function toLogoString(v: LogoValue): string {
  if (v === null) return ''
  if (isBoolean(v)) return v ? 'TRUE' : 'FALSE'
  if (isNumber(v)) return formatNumber(v)
  if (isWord(v)) return v
  if (isList(v)) return '[' + v.items.map(toLogoString).join(' ') + ']'
  if (isArray(v)) return '{' + v.items.map(toLogoString).join(' ') + '}'
  return ''
}

/** Format a number the way Logo does (no trailing .0 for integers). */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Strip trailing zeros from float representation.
  return String(n)
}

/**
 * Convert a string into a Logo value: if it parses as a number, return the
 * number; otherwise return the word.
 */
export function fromLogoString(s: string): LogoValue {
  const trimmed = s.trim()
  if (trimmed === '') return ''
  if (isNumericLiteral(trimmed)) return parseFloat(trimmed)
  return trimmed
}

/** True if the string is a valid Logo numeric literal. */
export function isNumericLiteral(s: string): boolean {
  if (s === '') return false
  // Optional sign, digits, optional fraction, optional exponent.
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)
}

/** True if the string is a valid integer literal. */
export function isIntegerLiteral(s: string): boolean {
  return /^[+-]?\d+$/.test(s)
}
