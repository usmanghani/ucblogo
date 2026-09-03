/**
 * Logo evaluator.
 *
 * A tree-walking interpreter. Lists are data; when a list is used as an
 * instruction list (IF, REPEAT, RUN, ...) its tokens are parsed on demand
 * with the current set of user procedures, so forward references resolve.
 *
 * Control flow (STOP / OUTPUT / THROW / GO / TOPLEVEL) uses exceptions
 * internally.
 */

import type { ASTNode, ProcCallNode, AritySource, ListNode, ListItem } from './parser'
import { parse, parseInstructionTokens } from './parser'
import { tokenize } from './lexer'
import type { LogoProc, LogoValue } from './types'
import { LogoList, LogoArray, isList, isNumber, isWord, isBoolean, logoEqual, listToSource, procArity } from './types'
import { Environment } from './environment'
import { LogoError, StopSignal, OutputSignal, ThrowSignal, GoSignal, TopLevelSignal, noHow } from './errors'

/** Context object shared with primitives. */
export interface EvalContext {
  env: Environment
  turtle?: unknown
  fs?: unknown
  output: (s: string) => void
  stop: () => void
  /** Read a line of input; undefined when no input source is attached. */
  readLine?: () => string | undefined
  /** Clear the text output area (CT / CLEARTEXT). */
  clearText?: () => void
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

export class Evaluator implements AritySource {
  private primitives = new Map<string, PrimitiveDef>()
  private ctx: EvalContext
  /** Number of nodes evaluated in the current program run. */
  steps = 0
  /** Abort a run after this many evaluated nodes (0 = unlimited). */
  maxSteps = 0
  /** Set by the host to stop the running program (Stop button). */
  abortRequested = false
  /** Stack of user procedures currently executing (innermost last). */
  procStack: LogoProc[] = []
  /** Maximum user-procedure nesting before reporting a stack overflow. */
  maxDepth = 100000

  constructor(ctx: EvalContext) {
    this.ctx = ctx
  }

  private tick(): void {
    this.steps++
    if (this.abortRequested) {
      this.abortRequested = false
      throw new LogoError('Stopped', 'STOPPED')
    }
    if (this.maxSteps > 0 && this.steps > this.maxSteps) {
      throw new LogoError(`Program exceeded the step limit (${this.maxSteps})`, 'STEP_LIMIT')
    }
  }

  /** AritySource: report user-defined procedure arity for the parser. */
  getProcArity(name: string): number | undefined {
    const proc = Environment.getProc(name.toUpperCase())
    if (proc) return procArity(proc)
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

  /** Names of all registered primitives. */
  primitiveNames(): string[] {
    return Array.from(this.primitives.keys())
  }

  /** Evaluate a sequence of statements, returning the last value. */
  evalSequence(nodes: ASTNode[], env: Environment): LogoValue {
    if (nodes.length === 0) return ''
    for (let i = 0; i < nodes.length - 1; i++) {
      this.eval(nodes[i], env)
    }
    return this.eval(nodes[nodes.length - 1], env)
  }

  /** Evaluate a single node. */
  eval(node: ASTNode, env: Environment): LogoValue {
    this.tick()
    switch (node.type) {
      case 'literal':
        return node.value
      case 'varref':
        return env.get(node.name.toUpperCase())
      case 'list':
        return this.listValue(node)
      case 'array':
        return new LogoArray(node.items.length, 1, '').fillFrom(node.items.map((i) => itemValue(i)))
      case 'infix':
        return this.evalInfix(node, env)
      case 'call':
        return this.evalCall(node, env)
      case 'procdef':
        // Register the procedure definition.
        Environment.setProc(node.name, {
          name: node.name,
          params: node.params,
          optionalParams: node.optionalParams,
          restParam: node.restParam,
          defaultArity: node.defaultArity,
          bodyTokens: node.bodyTokens,
          isMacro: node.isMacro,
          text: node.text,
        })
        return ''
    }
  }

  /** Build the runtime value of a list literal. */
  private listValue(node: ListNode): LogoList {
    if (node.compiled && node.tokens.length === 0) {
      // Synthetic block (from IF ... THEN): no data form; render the source.
      return new LogoList(node.compiled.map((n) => nodeToSource(n)))
    }
    return new LogoList(node.items.map((i) => itemValue(i)))
  }

  /** Evaluate an infix expression. */
  private evalInfix(node: Extract<ASTNode, { type: 'infix' }>, env: Environment): LogoValue {
    const left = this.eval(node.left, env)
    const right = this.eval(node.right, env)
    try {
      return this.applyInfix(node.op, left, right)
    } catch (e) {
      if (e instanceof LogoError && e.line === undefined) {
        e.line = node.line
        e.col = node.col
      }
      throw e
    }
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
   * Evaluate a procedure call.
   */
  private evalCall(node: ProcCallNode, env: Environment): LogoValue {
    try {
      return this.evalCallInner(node, env)
    } catch (e) {
      // Attach the source position of the innermost call that failed so the
      // host can point the user at the offending line.
      if (e instanceof LogoError && e.line === undefined) {
        e.line = node.line
        e.col = node.col
      }
      if (e instanceof RangeError) {
        throw new LogoError('Too much recursion (stack overflow)', 'USER', node.line, node.col)
      }
      throw e
    }
  }

  private evalCallInner(node: ProcCallNode, env: Environment): LogoValue {
    const name = node.name.toUpperCase()
    const proc = Environment.getProc(name)
    const prim = proc ? undefined : this.primitives.get(name)

    // Special forms handled by the evaluator (IF, IFELSE, REPEAT, ...).
    if (prim && prim.isSpecial) {
      return this.evalSpecial(prim, node, env)
    }

    // Primitive: evaluate args, call fn.
    if (prim) {
      const args = node.args.map((a) => this.eval(a, env))
      if (args.length < prim.minArgs) {
        throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS')
      }
      if (args.length > prim.maxArgs && prim.maxArgs >= 0) {
        throw new LogoError(`Too many inputs to ${name}`, 'TOO_MANY_INPUTS')
      }
      // Primitives see the caller's frame (dynamic scoping for LOCAL, MAKE,
      // templates run by MAP / FOREACH / ASK, ...).
      const savedEnv = this.ctx.env
      this.ctx.env = env
      try {
        return prim.fn(args, this.ctx)
      } finally {
        this.ctx.env = savedEnv
      }
    }

    // User-defined procedure.
    if (!proc) {
      throw noHow(name)
    }

    // Evaluate args in the caller's environment.
    const args = node.args.map((a) => this.eval(a, env))
    return this.callProc(proc, args, env)
  }

  /** Call a user procedure with already-evaluated inputs. */
  callProc(proc: LogoProc, args: LogoValue[], callerEnv: Environment): LogoValue {
    if (args.length < proc.params.length) {
      throw new LogoError(`${proc.name} needs more inputs`, 'NEED_MORE_INPUTS')
    }
    // Create a new frame (dynamic scoping: parent = caller).
    const newEnv = new Environment(callerEnv)
    let i = 0
    for (; i < proc.params.length; i++) {
      newEnv.set(proc.params[i].toUpperCase(), args[i] ?? '')
    }
    for (const opt of proc.optionalParams ?? []) {
      if (i < args.length) {
        newEnv.set(opt.name.toUpperCase(), args[i])
      } else {
        const nodes = parseInstructionTokens(opt.defaultTokens, this)
        newEnv.set(opt.name.toUpperCase(), this.evalSequence(nodes, newEnv))
      }
      i++
    }
    if (proc.restParam) {
      newEnv.set(proc.restParam.toUpperCase(), new LogoList(args.slice(i)))
    } else if (i < args.length && (proc.defaultArity === undefined || args.length > proc.defaultArity)) {
      throw new LogoError(`Too many inputs to ${proc.name}`, 'TOO_MANY_INPUTS')
    }

    // Macro: evaluate body, then evaluate the returned code.
    if (proc.isMacro) {
      const code = this.evalSequence(this.parseProcBody(proc), newEnv)
      return this.expandMacro(code, newEnv)
    }

    if (this.procStack.length >= this.maxDepth) {
      throw new LogoError(`Too much recursion in ${proc.name} (depth ${this.maxDepth})`, 'USER')
    }
    // Tail calls: when a body ends with a call to a user procedure, bind its
    // inputs and loop instead of recursing, so `TO LOOP ... LOOP END` runs in
    // constant stack space (as in UCBLogo).
    let current = proc
    let env = newEnv
    this.procStack.push(current)
    try {
      while (true) {
        const tail = this.runBody(current, env)
        if (!tail) return this.lastBodyResult
        const next = Environment.getProc(tail.name)!
        const args = tail.args.map((a) => this.eval(a, env))
        // Self tail-recursion replaces the frame (constant memory for
        // `TO LOOP ... LOOP END`); other tail calls keep the caller's frame so
        // dynamically-scoped variables stay visible to the callee.
        env = this.bindArgs(next, args, next === current ? (env.parent ?? callerEnv) : env)
        current = next
        this.procStack[this.procStack.length - 1] = current
      }
    } catch (e) {
      if (e instanceof OutputSignal) return e.value
      if (e instanceof StopSignal) return ''
      if (e instanceof LogoError && e.procName === undefined) e.procName = current.name
      throw e
    } finally {
      this.procStack.pop()
    }
  }

  private lastBodyResult: LogoValue = ''

  /** Bind evaluated inputs to a new frame for `proc`. */
  private bindArgs(proc: LogoProc, args: LogoValue[], parent: Environment): Environment {
    if (args.length < proc.params.length) {
      throw new LogoError(`${proc.name} needs more inputs`, 'NEED_MORE_INPUTS')
    }
    const newEnv = new Environment(parent)
    let i = 0
    for (; i < proc.params.length; i++) newEnv.set(proc.params[i].toUpperCase(), args[i] ?? '')
    for (const opt of proc.optionalParams ?? []) {
      if (i < args.length) newEnv.set(opt.name.toUpperCase(), args[i])
      else newEnv.set(opt.name.toUpperCase(), this.evalSequence(parseInstructionTokens(opt.defaultTokens, this), newEnv))
      i++
    }
    if (proc.restParam) newEnv.set(proc.restParam.toUpperCase(), new LogoList(args.slice(i)))
    return newEnv
  }

  /**
   * Run a procedure body, honouring GO "label jumps to LABEL "label lines.
   * Returns the trailing user-procedure call (unevaluated) when the body ends
   * in one, so the caller can perform a tail call; the value of the body is
   * left in `lastBodyResult`.
   */
  private runBody(proc: LogoProc, env: Environment): ProcCallNode | null {
    const body = this.parseProcBody(proc)
    let start = 0
    let result: LogoValue = ''
    const last = body[body.length - 1]
    const tail = last && last.type === 'call' && !this.primitives.has(last.name) && Environment.getProc(last.name) && !(proc.gotoLabels && proc.gotoLabels.size) ? last : null
    const end = tail ? body.length - 1 : body.length
    while (true) {
      try {
        for (let i = start; i < end; i++) {
          result = this.eval(body[i], env)
        }
        this.lastBodyResult = tail ? '' : result
        if (tail) this.tick()
        return tail
      } catch (e) {
        if (e instanceof GoSignal && proc.gotoLabels?.has(e.label)) {
          const idx = body.findIndex((n) => isLabelFor(n, e.label))
          if (idx < 0) throw new LogoError(`Can't find label ${e.label}`, 'USER')
          start = idx + 1
          continue
        }
        throw e
      }
    }
  }

  /** Expand a macro result (a list of instructions) and evaluate it. */
  private expandMacro(code: LogoValue, env: Environment): LogoValue {
    if (isList(code)) {
      return this.evalTemplate(code.items, env)
    }
    return code
  }

  /**
   * Evaluate a special form. These receive the AST node (not evaluated args)
   * so they can control evaluation (lazy branches, loops, etc.).
   */
  private evalSpecial(_prim: PrimitiveDef, node: ProcCallNode, env: Environment): LogoValue {
    const name = node.name.toUpperCase()

    switch (name) {
      case 'IF': {
        const cond = this.eval(node.args[0], env)
        if (truthy(cond)) {
          return this.evalInstructionList(node.args[1], env)
        }
        if (node.args.length > 2) return this.evalInstructionList(node.args[2], env)
        return ''
      }
      case 'IFELSE': {
        const cond = this.eval(node.args[0], env)
        if (truthy(cond)) {
          return this.evalInstructionList(node.args[1], env)
        }
        return this.evalInstructionList(node.args[2], env)
      }
      case 'REPEAT': {
        const count = this.eval(node.args[0], env)
        const body = node.args[1]
        const n = num(count)
        let result: LogoValue = ''
        const saved = env.has('REPCOUNT') ? env.get('REPCOUNT') : undefined
        for (let i = 0; i < n; i++) {
          env.set('REPCOUNT', i + 1)
          result = this.evalInstructionList(body, env)
        }
        if (saved !== undefined) env.set('REPCOUNT', saved)
        return result
      }
      case 'WHILE': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (truthy(this.evalCondition(cond, env))) {
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'UNTIL': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (!truthy(this.evalCondition(cond, env))) {
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'DO.WHILE':
      case 'DO.UNTIL': {
        const body = node.args[0]
        const cond = node.args[1]
        let result: LogoValue = ''
        do {
          result = this.evalInstructionList(body, env)
        } while (name === 'DO.WHILE' ? truthy(this.evalCondition(cond, env)) : !truthy(this.evalCondition(cond, env)))
        return result
      }
      case 'FOR': {
        // FOR [var start stop (step)] [body]
        const spec = node.args[0]
        let body = node.args[1]
        let varName: string
        let exprs: LogoValue[]
        if (node.args.length >= 4) {
          // FOR "var start stop [body] (step)
          varName = String(this.eval(spec, env))
          exprs = [this.eval(node.args[1], env), this.eval(node.args[2], env)]
          if (node.args.length >= 5) exprs.push(this.eval(node.args[4], env))
          body = node.args[3]
        } else if (spec.type === 'list') {
          const parts = this.forSpec(spec, env)
          varName = parts.name
          exprs = parts.values
        } else {
          const v = this.eval(spec, env)
          if (!isList(v) || v.items.length < 3) throw new LogoError('FOR needs [var start stop] as its first input', 'BAD_INPUT')
          varName = String(v.items[0])
          const rest = this.evalTemplateValues(v.items.slice(1), env)
          exprs = rest
        }
        const start = num(exprs[0])
        const stop = num(exprs[1])
        let step = exprs.length > 2 ? num(exprs[2]) : (start <= stop ? 1 : -1)
        if (step === 0) step = 1
        const nameStr = varName.toUpperCase()
        let result: LogoValue = ''
        if (step > 0) {
          for (let v = start; v <= stop + 1e-9; v += step) {
            env.set(nameStr, v)
            result = this.evalInstructionList(body, env)
          }
        } else {
          for (let v = start; v >= stop - 1e-9; v += step) {
            env.set(nameStr, v)
            result = this.evalInstructionList(body, env)
          }
        }
        return result
      }
      case 'DOTIMES': {
        // DOTIMES [var count] [body]
        const spec = node.args[0]
        const body = node.args[1]
        let varName: string
        let count: number
        if (spec.type === 'list') {
          const parts = this.forSpec(spec, env)
          varName = parts.name
          count = num(parts.values[0])
        } else {
          const v = this.eval(spec, env)
          if (!isList(v) || v.items.length < 2) throw new LogoError('DOTIMES needs [var count]', 'BAD_INPUT')
          varName = String(v.items[0])
          count = num(this.evalTemplateValues(v.items.slice(1), env)[0])
        }
        const nameStr = varName.toUpperCase()
        let result: LogoValue = ''
        for (let i = 0; i < count; i++) {
          env.set(nameStr, i)
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'FOREVER': {
        const body = node.args[0]
        let result: LogoValue = ''
        while (true) {
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'CATCH': {
        const tag = String(this.eval(node.args[0], env)).toUpperCase()
        const body = node.args[1]
        try {
          return this.evalInstructionList(body, env)
        } catch (e) {
          if (e instanceof ThrowSignal && (e.tag === tag || tag === 'ERROR' && false)) {
            return e.value
          }
          if (tag === 'ERROR' && e instanceof LogoError && e.code !== 'STOPPED' && e.code !== 'STEP_LIMIT') {
            env.setGlobal('__LAST_ERROR__', new LogoList([e.message, e.procName ?? '', e.line ?? 0]))
            return ''
          }
          throw e
        }
      }
      case 'THROW': {
        const tag = String(this.eval(node.args[0], env)).toUpperCase()
        const value = node.args.length > 1 ? this.eval(node.args[1], env) : ''
        if (tag === 'TOPLEVEL') throw new TopLevelSignal()
        if (tag === 'ERROR') throw new LogoError(isWord(value) && value !== '' ? value : 'Throw "Error', 'USER')
        throw new ThrowSignal(tag, value)
      }
      case 'STOP':
        throw new StopSignal()
      case 'OUTPUT':
      case 'OP':
        throw new OutputSignal(this.eval(node.args[0], env))
      case 'RUN': {
        return this.runCode(node.args[0], env)
      }
      case 'CASE': {
        const value = this.eval(node.args[0], env)
        const clauses = node.args[1]
        return this.evalCase(value, clauses, env)
      }
      case 'TEST': {
        const cond = this.eval(node.args[0], env)
        env.set('__TEST_RESULT__', cond)
        return ''
      }
      case 'IFTRUE':
      case 'IFT': {
        const result = env.has('__TEST_RESULT__') ? env.get('__TEST_RESULT__') : false
        if (truthy(result)) return this.evalInstructionList(node.args[0], env)
        return ''
      }
      case 'IFFALSE':
      case 'IFF': {
        const result = env.has('__TEST_RESULT__') ? env.get('__TEST_RESULT__') : false
        if (!truthy(result)) return this.evalInstructionList(node.args[0], env)
        return ''
      }
      case 'GO': {
        const label = String(this.eval(node.args[0], env)).toUpperCase()
        throw new GoSignal(label)
      }
      case 'LABEL': {
        // Inside a procedure that GOes to this label, LABEL is a marker.
        const arg = node.args[0]
        const current = this.procStack[this.procStack.length - 1]
        if (arg && arg.type === 'literal' && current?.gotoLabels?.has(String(arg.value).toUpperCase())) {
          return ''
        }
        // Otherwise LABEL draws text at the turtle position (UCBLogo).
        const prim = this.primitives.get('LABEL.TEXT')
        if (prim) return prim.fn([this.eval(arg, env)], this.ctx)
        return ''
      }
      case 'TOPLEVEL':
        throw new TopLevelSignal()
      case 'SETXY': {
        // Terrapin accepts SETXY x y and SETXY [x y]; when the first input turns
        // out to be a list at run time, the statically-parsed second input was
        // really the next instruction, so run it afterwards.
        const first = this.eval(node.args[0], env)
        const impl = this.primitives.get('SETXY.IMPL')!
        if (isList(first)) {
          impl.fn([first], this.ctx)
          return node.args[1] ? this.eval(node.args[1], env) : ''
        }
        if (!node.args[1]) throw new LogoError('SETXY needs more inputs', 'NEED_MORE_INPUTS')
        return impl.fn([first, this.eval(node.args[1], env)], this.ctx)
      }
      case 'RETURN':
        return this.eval(node.args[0], env)
      case 'BREAK':
      case 'CONTINUE':
        return ''
      default:
        throw new LogoError(`Unknown special form ${name}`, 'SYNTAX')
    }
  }

  /** Parse the `[var start stop step]` list of FOR / DOTIMES. */
  private forSpec(spec: ListNode, env: Environment): { name: string; values: LogoValue[] } {
    const toks = spec.tokens
    if (toks.length < 2) throw new LogoError('FOR needs [var start stop] as its first input', 'BAD_INPUT')
    const first = toks[0]
    const name = first.value
    const nodes = parseInstructionTokens(toks.slice(1), this)
    const values = nodes.map((n) => this.eval(n, env))
    return { name, values }
  }

  /** A condition may be an expression or an instruction list (WHILE [...]). */
  private evalCondition(node: ASTNode, env: Environment): LogoValue {
    if (node.type === 'list') return this.evalInstructionList(node, env)
    const v = this.eval(node, env)
    if (isList(v)) return this.evalTemplate(v.items, env)
    return v
  }

  /** Parse a procedure's body tokens into AST at call time (cached). */
  parseProcBody(proc: LogoProc): ASTNode[] {
    if (proc.compiled && proc.compiledGen === Environment.procGen) return proc.compiled
    const ast = parseInstructionTokens(proc.bodyTokens, this)
    proc.compiled = ast
    proc.compiledGen = Environment.procGen
    proc.gotoLabels = collectGotoLabels(ast)
    return ast
  }

  /** Compile a list node's tokens into instructions (cached per procedure generation). */
  compileList(node: ListNode): ASTNode[] {
    if (node.compiled && (node.compiledGen === Environment.procGen || node.compiledGen === -1)) return node.compiled
    const ast = parseInstructionTokens(node.tokens, this)
    node.compiled = ast
    node.compiledGen = Environment.procGen
    return ast
  }

  /** Evaluate an instruction list (a list node, or an expression yielding a list). */
  evalInstructionList(node: ASTNode, env: Environment): LogoValue {
    if (node.type === 'list') {
      return this.evalSequence(this.compileList(node), env)
    }
    const v = this.eval(node, env)
    if (isList(v)) return this.evalTemplate(v.items, env)
    if (isWord(v)) return this.evalTemplate([v], env)
    return v
  }

  /** Evaluate a RUN argument (list of instructions or code string). */
  private runCode(code: ASTNode, env: Environment): LogoValue {
    return this.evalInstructionList(code, env)
  }

  /** Evaluate a CASE expression. */
  private evalCase(value: LogoValue, clauses: ASTNode, env: Environment): LogoValue {
    const list = clauses.type === 'list' ? this.listValue(clauses) : this.eval(clauses, env)
    if (!isList(list)) {
      throw new LogoError('CASE needs a list of clauses', 'BAD_INPUT')
    }
    for (const clause of list.items) {
      if (!isList(clause) || clause.items.length === 0) continue
      const cond = clause.items[0]
      const rest = clause.items.slice(1)
      if (isWord(cond) && cond.toUpperCase() === 'ELSE') {
        return this.evalTemplate(rest, env)
      }
      const candidates = isList(cond) ? cond.items : [cond]
      const matched = candidates.some((c) => logoEqual(isList(c) ? c : this.evalTemplateValue(c, env), value))
      if (matched) return this.evalTemplate(rest, env)
    }
    return ''
  }

  private evalTemplateValue(item: LogoValue, env: Environment): LogoValue {
    if (isWord(item) && (item.startsWith(':') || item.startsWith('"'))) return this.evalTemplate([item], env)
    return item
  }

  /** Evaluate a LogoList of instructions in a template context (MAP, FILTER, RUN of a value). */
  evalTemplate(items: LogoValue[], env: Environment): LogoValue {
    const text = listToSource(items)
    if (!text.trim()) return ''
    const ast = parse(tokenize(text), this)
    return this.evalSequence(ast, env)
  }

  /**
   * Evaluate a template list with `?` / `?N` substituted by the given inputs
   * (textually, as Terrapin does, so `"?` and `?` both work), and also bound as
   * variables `?`, `?1`, `?2`, ... for UCBLogo-style templates.
   */
  evalTemplateWith(items: LogoValue[], env: Environment, inputs: LogoValue[]): LogoValue {
    const text = listToSource(items)
    if (!text.trim()) return ''
    const tokens = tokenize(text).flatMap((t) => {
      const m = /^\?(\d*)$/.exec(t.value)
      if (!m || (t.type !== 'WORD' && t.type !== 'STRING')) return [t]
      const idx = m[1] === '' ? 0 : parseInt(m[1], 10) - 1
      const v = inputs[idx]
      if (v === undefined) return [t]
      if (isList(v)) {
        // Splice the list in as a list literal.
        const inner = tokenize(listToSource(v.items)).filter((x) => x.type !== 'EOF')
        return [{ ...t, type: 'LBRACKET' as const, value: '[' }, ...inner.map((x) => ({ ...x, line: t.line, col: t.col })), { ...t, type: 'RBRACKET' as const, value: ']' }]
      }
      if (t.type === 'STRING') return [{ ...t, value: String(v) }]
      if (isNumber(v)) return [{ ...t, type: 'NUMBER' as const, value: String(v) }]
      return [{ ...t, type: 'STRING' as const, value: String(v) }]
    })
    const ast = parse(tokens, this)
    return this.evalSequence(ast, env)
  }

  /** Evaluate each expression in a list of instruction words, returning all values. */
  evalTemplateValues(items: LogoValue[], env: Environment): LogoValue[] {
    const text = listToSource(items)
    if (!text.trim()) return []
    const ast = parse(tokenize(text), this)
    return ast.map((n) => this.eval(n, env))
  }

  /** Run a parsed program, catching control-flow signals. */
  runProgram(nodes: ASTNode[], env: Environment): LogoValue {
    this.procStack = []
    try {
      return this.evalSequence(nodes, env)
    } catch (e) {
      if (e instanceof StopSignal) return ''
      if (e instanceof OutputSignal) return e.value
      if (e instanceof TopLevelSignal) return ''
      if (e instanceof GoSignal) throw new LogoError(`Can't find label ${e.label}`, 'USER')
      if (e instanceof ThrowSignal) throw new LogoError(`Can't find catch tag for ${e.tag}`, 'THROW')
      throw e
    }
  }
}

// --- Helpers ---

/** Runtime value of a list data item. */
export function itemValue(item: ListItem): LogoValue {
  if (typeof item === 'number') return item
  if (typeof item === 'string') return item
  if (item.type === 'list') return new LogoList(item.items.map(itemValue))
  return new LogoArray(item.items.length, 1, '').fillFrom(item.items.map(itemValue))
}

/** Render an AST node back to Logo source (for synthetic blocks). */
export function nodeToSource(node: ASTNode): string {
  switch (node.type) {
    case 'literal':
      return typeof node.value === 'string' ? '"' + node.value : String(node.value)
    case 'varref':
      return ':' + node.name
    case 'list':
      return '[' + (node.compiled && node.tokens.length === 0 ? node.compiled.map(nodeToSource).join(' ') : node.items.map(itemToSource).join(' ')) + ']'
    case 'array':
      return '{' + node.items.map(itemToSource).join(' ') + '}'
    case 'infix':
      return `${nodeToSource(node.left)} ${node.op} ${nodeToSource(node.right)}`
    case 'call':
      return node.args.length ? `(${node.name} ${node.args.map(nodeToSource).join(' ')})` : node.name
    case 'procdef':
      return node.text
  }
}

function itemToSource(item: ListItem): string {
  if (typeof item === 'number') return String(item)
  if (typeof item === 'string') return item
  return nodeToSource(item)
}

function collectGotoLabels(nodes: ASTNode[]): Set<string> {
  const labels = new Set<string>()
  const visit = (n: ASTNode): void => {
    if (n.type === 'call') {
      if (n.name === 'GO' && n.args[0]?.type === 'literal') labels.add(String(n.args[0].value).toUpperCase())
      n.args.forEach(visit)
    } else if (n.type === 'infix') {
      visit(n.left)
      visit(n.right)
    } else if (n.type === 'list' && n.compiled) {
      n.compiled.forEach(visit)
    } else if (n.type === 'list' && n.tokens.length) {
      // Scan raw tokens for GO "label inside nested instruction lists.
      for (let i = 0; i + 1 < n.tokens.length; i++) {
        if (n.tokens[i].type === 'WORD' && n.tokens[i].value.toUpperCase() === 'GO' && n.tokens[i + 1].type === 'STRING') {
          labels.add(n.tokens[i + 1].value.toUpperCase())
        }
      }
    }
  }
  nodes.forEach(visit)
  return labels
}

function isLabelFor(n: ASTNode, label: string): boolean {
  return n.type === 'call' && n.name === 'LABEL' && n.args[0]?.type === 'literal' && String(n.args[0].value).toUpperCase() === label
}

function num(v: LogoValue): number {
  if (isNumber(v)) return v
  if (isWord(v) && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  throw new LogoError(`Expected a number, got ${isList(v) ? '[' + listToSource(v.items) + ']' : String(v)}`, 'BAD_INPUT')
}

export function truthy(v: LogoValue): boolean {
  if (isWord(v)) return v !== '' && v.toUpperCase() !== 'FALSE'
  if (isBoolean(v)) return v
  if (isNumber(v)) return v !== 0
  if (isList(v)) return !v.isEmpty()
  return v !== null
}
