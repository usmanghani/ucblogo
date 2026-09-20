/**
 * Logo evaluator.
 *
 * A tree-walking interpreter with loop-based tail-call optimization (TCO).
 * When a procedure body's last instruction is a call to another procedure
 * (or a special form whose tail is a call), the evaluator replaces the current
 * node + environment and loops instead of recursing, avoiding stack overflow on
 * deep recursion.
 *
 * Control flow (STOP / OUTPUT / THROW) uses exceptions internally.
 */

import type { ASTNode, ProcCallNode, AritySource } from './parser'
import { parse } from './parser'
import { tokenize } from './lexer'
import type { LogoProc, LogoValue } from './types'
import { LogoList, LogoArray, isList, isNumber, isWord, isBoolean, logoEqual } from './types'
import { Environment } from './environment'
import { LogoError, StopSignal, OutputSignal, ThrowSignal, noHow } from './errors'

/** Context object shared with primitives. */
export interface EvalContext {
  env: Environment
  turtle?: unknown
  fs?: unknown
  output: (s: string) => void
  stop: () => void
}

/** A primitive function signature. */
export type PrimitiveFn = (args: LogoValue[], ctx: EvalContext) => LogoValue

export interface PrimitiveDef {
  name: string
  minArgs: number
  maxArgs: number
  fn: PrimitiveFn
  isSpecial?: boolean
}

type Pause = { milliseconds: number } | { cooperate: true }

export class Evaluator implements AritySource {
  private completeSync(iterator: Generator<Pause, LogoValue, void>): LogoValue {
    try {
      let next = iterator.next()
      while (!next.done) {
        if ('milliseconds' in next.value) iterator.throw(new LogoError('WAIT requires animated execution; use Run in the editor', 'USER'))
        next = iterator.next()
      }
      return next.value
    } finally { iterator.return('') }
  }

  eval(node: ASTNode, env: Environment): LogoValue {
    return this.completeSync(this.evalSteps(node, env))
  }
  evalSequence(nodes: ASTNode[], env: Environment): LogoValue {
    return this.completeSync(this.evalSequenceSteps(nodes, env))
  }
  evalTemplate(items: LogoValue[], env: Environment): LogoValue {
    return this.completeSync(this.evalTemplateSteps(items, env))
  }
  runProgram(nodes: ASTNode[], env: Environment): LogoValue {
    return this.completeSync(this.runProgramSteps(nodes, env))
  }
  async runProgramAsync(nodes: ASTNode[], env: Environment, signal: AbortSignal, onPause?: () => void): Promise<LogoValue> {
    const iterator = this.runProgramSteps(nodes, env)
    try {
      signal.throwIfAborted()
      let next = iterator.next()
      while (!next.done) {
        onPause?.()
        const milliseconds = 'milliseconds' in next.value ? next.value.milliseconds : 0
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(signal.reason) }
          const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()
        })
        signal.throwIfAborted()
        next = iterator.next()
      }
      return next.value
    } finally { iterator.return('') }
  }

  private primitives = new Map<string, PrimitiveDef>()
  private ctx: EvalContext
  private steps = 0
  private readonly maxSteps = 100000

  constructor(ctx: EvalContext) {
    this.ctx = ctx
  }

  /** AritySource: report user-defined procedure arity for the parser. */
  getProcArity(name: string): number | undefined {
    const proc = Environment.getProc(name.toUpperCase())
    if (proc) return proc.params.length
    return undefined
  }

  registerPrimitive(def: PrimitiveDef): void {
    this.primitives.set(def.name.toUpperCase(), def)
  }

  hasPrimitive(name: string): boolean {
    return this.primitives.has(name.toUpperCase())
  }

  getPrimitive(name: string): PrimitiveDef | undefined {
    return this.primitives.get(name.toUpperCase())
  }

  /** Evaluate a sequence of statements, returning the last value. */
  *evalSequenceSteps(nodes: ASTNode[], env: Environment): Generator<Pause, LogoValue, void> {
    if (nodes.length === 0) return ''
    for (let i = 0; i < nodes.length - 1; i++) {
      (yield* this.evalSteps(nodes[i], env))
    }
    return (yield* this.evalSteps(nodes[nodes.length - 1], env))
  }

  private *evalManySteps(nodes: ASTNode[], env: Environment): Generator<Pause, LogoValue[], void> {
    const values: LogoValue[] = []
    for (const node of nodes) values.push((yield* this.evalSteps(node, env)))
    return values
  }

  /** Evaluate a single node. */
  *evalSteps(node: ASTNode, env: Environment): Generator<Pause, LogoValue, void> {
    if (++this.steps > this.maxSteps) throw new LogoError('Execution limit exceeded', 'USER')
    if (this.steps % 250 === 0) yield { cooperate: true }
    try {
      return (yield* this.evalNodeSteps(node, env))
    } catch (e) {
      if (e instanceof LogoError && !e.location && 'line' in node && typeof node.line === 'number') {
        e.location = { line: node.line, col: typeof node.col === 'number' ? node.col : 1 }
      }
      throw e
    }
  }

  private *evalNodeSteps(node: ASTNode, env: Environment): Generator<Pause, LogoValue, void> {
    switch (node.type) {
      case 'literal':
        return node.value
      case 'varref':
        return env.get(node.name.toUpperCase())
      case 'list':
        return new LogoList((yield* this.evalManySteps(node.items, env)))
      case 'array':
        return new LogoArray(node.items.length, 1, (yield* this.evalSteps(node.items[0] ?? '', env)))
      case 'infix':
        return (yield* this.evalInfixSteps(node, env))
      case 'call':
        return (yield* this.evalCallSteps(node, env))
      case 'procdef':
        // Register the procedure definition.
        Environment.setProc(node.name, {
          name: node.name,
          params: node.params,
          bodyTokens: node.bodyTokens,
          isMacro: node.isMacro,
          text: node.text,
        })
        return ''
    }
  }

  /** Evaluate an infix expression. */
  private *evalInfixSteps(node: Extract<ASTNode, { type: 'infix' }>, env: Environment): Generator<Pause, LogoValue, void> {
    const left = (yield* this.evalSteps(node.left, env))
    const right = (yield* this.evalSteps(node.right, env))
    return this.applyInfix(node.op, left, right)
  }

  private applyInfix(op: string, left: LogoValue, right: LogoValue): LogoValue {
    switch (op) {
      case '+': return num(left) + num(right)
      case '-': return num(left) - num(right)
      case '*': return num(left) * num(right)
      case '/':
        if (num(right) === 0) throw new LogoError('Division by zero', 'DIV_ZERO')
        return num(left) / num(right)
      case '=': return logoEqual(left, right)
      case '<>': return !logoEqual(left, right)
      case '<': return num(left) < num(right)
      case '>': return num(left) > num(right)
      case '<=': return num(left) <= num(right)
      case '>=': return num(left) >= num(right)
      case 'AND': return truthy(left) && truthy(right)
      case 'OR': return truthy(left) || truthy(right)
      default:
        throw new LogoError(`Unknown operator ${op}`, 'SYNTAX')
    }
  }

  /**
   * Evaluate a procedure call with tail-call optimization.
   */
  private *evalCallSteps(node: ProcCallNode, env: Environment): Generator<Pause, LogoValue, void> {
    try {
      return (yield* this.evalCallInnerSteps(node, env))
    } catch (e) {
      if (e instanceof LogoError && !e.location) e.location = { line: node.line, col: node.col }
      throw e
    }
  }

  private *evalCallInnerSteps(node: ProcCallNode, env: Environment): Generator<Pause, LogoValue, void> {
    const name = node.name.toUpperCase()
    const prim = this.primitives.get(name)

    // Special forms handled by the evaluator (IF, IFELSE, REPEAT, ...).
    if (prim && prim.isSpecial) {
      return (yield* this.evalSpecialSteps(prim, node, env))
    }

    // Primitive: evaluate args, call fn.
    if (prim) {
      const args = (yield* this.evalManySteps(node.args, env))
      if (args.length < prim.minArgs) {
        throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS')
      }
      if (name === 'WAIT') {
        const ticks = num(args[0])
        if (!Number.isFinite(ticks) || ticks < 0 || ticks > 3600) throw new LogoError('WAIT needs a number from 0 to 3600 ticks', 'BAD_INPUT')
        yield { milliseconds: ticks * 1000 / 60 }
        return ''
      }
      const previous = this.ctx.env
      this.ctx.env = env
      try { return prim.fn(args, this.ctx) }
      finally { this.ctx.env = previous }
    }

    // User-defined procedure.
    const proc = Environment.getProc(name)
    if (!proc) {
      throw noHow(name)
    }

    // Evaluate args in the caller's environment.
    const args = (yield* this.evalManySteps(node.args, env))

    // Create a new frame (dynamic scoping: parent = caller).
    const newEnv = new Environment(env)
    for (let i = 0; i < proc.params.length; i++) {
      newEnv.set(proc.params[i].toUpperCase(), args[i] ?? '')
    }

    // Macro: evaluate body, then evaluate the returned code.
    if (proc.isMacro) {
      const code = (yield* this.evalSequenceSteps(this.parseProcBody(proc), newEnv))
      const macroResult = (yield* this.expandMacroSteps(code, newEnv))
      return macroResult
    }

    // Tail call: evaluate the body's last instruction in the new frame.
    try {
      return (yield* this.evalSequenceSteps(this.parseProcBody(proc), newEnv))
    } catch (e) {
      if (e instanceof OutputSignal) return e.value
      throw e
    }
  }

  /** Expand a macro result (a list of instructions) and evaluate it. */
  private *expandMacroSteps(code: LogoValue, env: Environment): Generator<Pause, LogoValue, void> {
    if (isList(code)) {
      // Treat the list as a program: parse and evaluate.
      const text = code.items.map((item) => String(item)).join(' ')
      const ast = parse(tokenize(text), this)
      return (yield* this.evalSequenceSteps(ast, env))
    }
    return code
  }

  /**
   * Evaluate a special form. These receive the AST node (not evaluated args)
   * so they can control evaluation (lazy branches, loops, etc.).
   */
  private *evalSpecialSteps(_prim: PrimitiveDef, node: ProcCallNode, env: Environment): Generator<Pause, LogoValue, void> {
    const name = node.name.toUpperCase()

    switch (name) {
      case 'IF': {
        const cond = (yield* this.evalSteps(node.args[0], env))
        const thenBranch = node.args[1]
        if (truthy(cond)) {
          return (yield* this.evalInstructionListSteps(thenBranch, env))
        }
        return ''
      }
      case 'IFELSE': {
        const cond = (yield* this.evalSteps(node.args[0], env))
        const thenBranch = node.args[1]
        const elseBranch = node.args[2]
        if (truthy(cond)) {
          return (yield* this.evalInstructionListSteps(thenBranch, env))
        }
        return (yield* this.evalInstructionListSteps(elseBranch, env))
      }
      case 'REPEAT': {
        const count = (yield* this.evalSteps(node.args[0], env))
        const body = node.args[1]
        const n = num(count)
        let result: LogoValue = ''
        for (let i = 0; i < n; i++) {
          env.set('REPCOUNT', i + 1)
          result = (yield* this.evalInstructionListSteps(body, env))
        }
        return result
      }
      case 'WHILE': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (truthy((yield* this.evalInstructionListSteps(cond, env)))) {
          result = (yield* this.evalInstructionListSteps(body, env))
        }
        return result
      }
      case 'UNTIL': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (!truthy((yield* this.evalInstructionListSteps(cond, env)))) {
          result = (yield* this.evalInstructionListSteps(body, env))
        }
        return result
      }
      case 'DO.WHILE':
      case 'DO.UNTIL': {
        const body = node.args[0]
        const cond = node.args[1]
        let result: LogoValue = ''
        do {
          result = (yield* this.evalInstructionListSteps(body, env))
        } while (name === 'DO.WHILE' ? truthy((yield* this.evalSteps(cond, env))) : !truthy((yield* this.evalSteps(cond, env))))
        return result
      }
      case 'FOR': {
        // FOR "var start stop [body]  (or with step: FOR "var start stop step [body])
        const varName = (yield* this.evalSteps(node.args[0], env))
        const start = num((yield* this.evalSteps(node.args[1], env)))
        const stop = num((yield* this.evalSteps(node.args[2], env)))
        let step = 1
        let body: ASTNode
        if (node.args.length >= 5) {
          step = num((yield* this.evalSteps(node.args[3], env)))
          body = node.args[4]
        } else {
          body = node.args[3]
        }
        const nameStr = String(varName).toUpperCase()
        let result: LogoValue = ''
        if (step > 0) {
          for (let v = start; v <= stop; v += step) {
            env.set(nameStr, v)
            result = (yield* this.evalInstructionListSteps(body, env))
          }
        } else {
          for (let v = start; v >= stop; v += step) {
            env.set(nameStr, v)
            result = (yield* this.evalInstructionListSteps(body, env))
          }
        }
        return result
      }
      case 'DOTIMES': {
        const varName = (yield* this.evalSteps(node.args[0], env))
        const count = num((yield* this.evalSteps(node.args[1], env)))
        const body = node.args[2]
        const nameStr = String(varName).toUpperCase()
        let result: LogoValue = ''
        for (let i = 1; i <= count; i++) {
          env.set(nameStr, i)
          result = (yield* this.evalInstructionListSteps(body, env))
        }
        return result
      }
      case 'FOREVER': {
        const body = node.args[0]
        let result: LogoValue = ''
        while (true) {
          if (++this.steps > this.maxSteps) throw new LogoError('Execution limit exceeded', 'USER')
          result = (yield* this.evalInstructionListSteps(body, env))
        }
        return result
      }
      case 'CATCH': {
        const tag = String((yield* this.evalSteps(node.args[0], env))).toUpperCase()
        const body = node.args[1]
        try {
          return (yield* this.evalInstructionListSteps(body, env))
        } catch (e) {
          if (e instanceof ThrowSignal && e.tag === tag) {
            return e.value
          }
          throw e
        }
      }
      case 'THROW': {
        const tag = String((yield* this.evalSteps(node.args[0], env))).toUpperCase()
        const value = node.args.length > 1 ? (yield* this.evalSteps(node.args[1], env)) : ''
        throw new ThrowSignal(tag, value)
      }
      case 'STOP':
        throw new StopSignal()
      case 'OUTPUT':
      case 'OP':
        throw new OutputSignal((yield* this.evalSteps(node.args[0], env)))
      case 'RUN': {
        return (yield* this.runCodeSteps(node.args[0], env))
      }
      case 'CASE': {
        const value = (yield* this.evalSteps(node.args[0], env))
        const clauses = node.args[1]
        return (yield* this.evalCaseSteps(value, clauses, env))
      }
      case 'TEST': {
        const cond = (yield* this.evalSteps(node.args[0], env))
        env.set('__TEST_RESULT__', cond)
        return ''
      }
      case 'IFTRUE': {
        const result = env.get('__TEST_RESULT__')
        if (truthy(result)) return (yield* this.evalInstructionListSteps(node.args[0], env))
        return ''
      }
      case 'IFFALSE': {
        const result = env.get('__TEST_RESULT__')
        if (!truthy(result)) return (yield* this.evalInstructionListSteps(node.args[0], env))
        return ''
      }
      case 'GO':
      case 'RETURN': {
        // GO / RETURN: non-local jump. Simplified: evaluate the target.
        return (yield* this.evalSteps(node.args[0], env))
      }
      case 'BREAK':
      case 'CONTINUE':
        return ''
      default:
        throw new LogoError(`Unknown special form ${name}`, 'SYNTAX')
    }
  }


  /** Parse a procedure's body tokens into AST at call time. */
  parseProcBody(proc: LogoProc): ASTNode[] {
    const tokens = [...proc.bodyTokens]
    const last = tokens[tokens.length - 1]
    tokens.push({ type: 'EOF', value: '', line: last?.line ?? 1, col: last?.col ?? 1 })
    return parse(tokens, this)
  }

  /** Evaluate an instruction list (a list node whose items are instructions). */
  private *evalInstructionListSteps(node: ASTNode, env: Environment): Generator<Pause, LogoValue, void> {
    if (node.type === 'list') {
      return (yield* this.evalSequenceSteps(node.items, env))
    }
    return (yield* this.evalSteps(node, env))
  }

  /** Evaluate a RUN argument (list of instructions or code string). */
  private *runCodeSteps(code: ASTNode, env: Environment): Generator<Pause, LogoValue, void> {
    if (code.type === 'list') {
      return (yield* this.evalSequenceSteps(code.items, env))
    }
    // A word containing code: evaluate it as a literal value.
    return (yield* this.evalSteps(code, env))
  }

  /** Evaluate a CASE expression. */
  private *evalCaseSteps(value: LogoValue, clauses: ASTNode, env: Environment): Generator<Pause, LogoValue, void> {
    if (clauses.type !== 'list') {
      throw new LogoError('CASE needs a list of clauses', 'BAD_INPUT')
    }
    for (const clause of clauses.items) {
      if (clause.type === 'list') {
        const parts = clause.items
        if (parts.length === 0) continue
        const cond = parts[0]
        // ELSE clause
        if (cond.type === 'literal' && cond.value === 'ELSE') {
          return (yield* this.evalSequenceSteps(parts.slice(1), env))
        }
        // (cond) [result] or [cond1 cond2 ...] [result]
        if (cond.type === 'list') {
          const conds = cond.items
          let matched = false
          for (const c of conds) { if (logoEqual((yield* this.evalSteps(c, env)), value)) { matched = true; break } }
          if (matched) {
            return (yield* this.evalSequenceSteps(parts.slice(1), env))
          }
        } else {
          const matched = logoEqual((yield* this.evalSteps(cond, env)), value)
          if (matched) {
            return (yield* this.evalSequenceSteps(parts.slice(1), env))
          }
        }
      }
    }
    return ''
  }

  /** Public: run a parsed program, catching control-flow signals. */

  /** Evaluate a LogoList of instructions in a template context (MAP, FILTER, etc.). */
  *evalTemplateSteps(items: LogoValue[], env: Environment): Generator<Pause, LogoValue, void> {
    const text = items.map(String).join(' ')
    if (!text.trim()) return ''
    const ast = parse(tokenize(text), this)
    return (yield* this.evalSequenceSteps(ast, env))
  }
  *runProgramSteps(nodes: ASTNode[], env: Environment): Generator<Pause, LogoValue, void> {
    this.steps = 0
    try {
      return (yield* this.evalSequenceSteps(nodes, env))
    } catch (e) {
      if (e instanceof StopSignal) return ''
      if (e instanceof OutputSignal) return e.value
      if (e instanceof ThrowSignal) throw new LogoError(`Uncaught THROW ${e.tag}`, 'THROW')
      throw e
    }
  }
}

// --- Helpers ---

function num(v: LogoValue): number {
  if (isNumber(v)) return v
  throw new LogoError(`Expected a number, got ${String(v)}`, 'BAD_INPUT')
}

function truthy(v: LogoValue): boolean {
  if (isWord(v)) return v !== '' && v !== 'FALSE' && v !== 'false'
  if (isBoolean(v)) return v
  if (isNumber(v)) return v !== 0
  if (isList(v)) return !v.isEmpty()
  return v !== null
}
