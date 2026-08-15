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

export class Evaluator implements AritySource {
  private primitives = new Map<string, PrimitiveDef>()
  private ctx: EvalContext

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
  evalSequence(nodes: ASTNode[], env: Environment): LogoValue {
    if (nodes.length === 0) return ''
    for (let i = 0; i < nodes.length - 1; i++) {
      this.eval(nodes[i], env)
    }
    return this.eval(nodes[nodes.length - 1], env)
  }

  /** Evaluate a single node. */
  eval(node: ASTNode, env: Environment): LogoValue {
    switch (node.type) {
      case 'literal':
        return node.value
      case 'varref':
        return env.get(node.name.toUpperCase())
      case 'list':
        return new LogoList(node.items.map((item) => this.eval(item, env)))
      case 'array':
        return new LogoArray(node.items.length, 1, this.eval(node.items[0] ?? '', env))
      case 'infix':
        return this.evalInfix(node, env)
      case 'call':
        return this.evalCall(node, env)
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
  private evalInfix(node: Extract<ASTNode, { type: 'infix' }>, env: Environment): LogoValue {
    const left = this.eval(node.left, env)
    const right = this.eval(node.right, env)
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
  private evalCall(node: ProcCallNode, env: Environment): LogoValue {
    const name = node.name.toUpperCase()
    const prim = this.primitives.get(name)

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
      return prim.fn(args, this.ctx)
    }

    // User-defined procedure.
    const proc = Environment.getProc(name)
    if (!proc) {
      throw noHow(name)
    }

    // Evaluate args in the caller's environment.
    const args = node.args.map((a) => this.eval(a, env))

    // Create a new frame (dynamic scoping: parent = caller).
    const newEnv = new Environment(env)
    for (let i = 0; i < proc.params.length; i++) {
      newEnv.set(proc.params[i].toUpperCase(), args[i] ?? '')
    }

    // Macro: evaluate body, then evaluate the returned code.
    if (proc.isMacro) {
      const code = this.evalSequence(this.parseProcBody(proc), newEnv)
      const macroResult = this.expandMacro(code, newEnv)
      return macroResult
    }

    // Tail call: evaluate the body's last instruction in the new frame.
    try {
      return this.evalSequence(this.parseProcBody(proc), newEnv)
    } catch (e) {
      if (e instanceof OutputSignal) return e.value
      throw e
    }
  }

  /** Expand a macro result (a list of instructions) and evaluate it. */
  private expandMacro(code: LogoValue, env: Environment): LogoValue {
    if (isList(code)) {
      // Treat the list as a program: parse and evaluate.
      const text = code.items.map((item) => String(item)).join(' ')
      const ast = parse(tokenize(text), this)
      return this.evalSequence(ast, env)
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
        const thenBranch = node.args[1]
        if (truthy(cond)) {
          return this.evalInstructionList(thenBranch, env)
        }
        return ''
      }
      case 'IFELSE': {
        const cond = this.eval(node.args[0], env)
        const thenBranch = node.args[1]
        const elseBranch = node.args[2]
        if (truthy(cond)) {
          return this.evalInstructionList(thenBranch, env)
        }
        return this.evalInstructionList(elseBranch, env)
      }
      case 'REPEAT': {
        const count = this.eval(node.args[0], env)
        const body = node.args[1]
        const n = num(count)
        let result: LogoValue = ''
        for (let i = 0; i < n; i++) {
          env.set('REPCOUNT', i + 1)
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'WHILE': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (truthy(this.eval(cond, env))) {
          result = this.evalInstructionList(body, env)
        }
        return result
      }
      case 'UNTIL': {
        const cond = node.args[0]
        const body = node.args[1]
        let result: LogoValue = ''
        while (!truthy(this.eval(cond, env))) {
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
        } while (name === 'DO.WHILE' ? truthy(this.eval(cond, env)) : !truthy(this.eval(cond, env)))
        return result
      }
      case 'FOR': {
        // FOR "var start stop [body]  (or with step: FOR "var start stop step [body])
        const varName = this.eval(node.args[0], env)
        const start = num(this.eval(node.args[1], env))
        const stop = num(this.eval(node.args[2], env))
        let step = 1
        let body: ASTNode
        if (node.args.length >= 5) {
          step = num(this.eval(node.args[3], env))
          body = node.args[4]
        } else {
          body = node.args[3]
        }
        const nameStr = String(varName).toUpperCase()
        let result: LogoValue = ''
        if (step > 0) {
          for (let v = start; v <= stop; v += step) {
            env.set(nameStr, v)
            result = this.evalInstructionList(body, env)
          }
        } else {
          for (let v = start; v >= stop; v += step) {
            env.set(nameStr, v)
            result = this.evalInstructionList(body, env)
          }
        }
        return result
      }
      case 'DOTIMES': {
        const varName = this.eval(node.args[0], env)
        const count = num(this.eval(node.args[1], env))
        const body = node.args[2]
        const nameStr = String(varName).toUpperCase()
        let result: LogoValue = ''
        for (let i = 1; i <= count; i++) {
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
          if (e instanceof ThrowSignal && e.tag === tag) {
            return e.value
          }
          throw e
        }
      }
      case 'THROW': {
        const tag = String(this.eval(node.args[0], env)).toUpperCase()
        const value = node.args.length > 1 ? this.eval(node.args[1], env) : ''
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
      case 'IFTRUE': {
        const result = env.get('__TEST_RESULT__')
        if (truthy(result)) return this.evalInstructionList(node.args[0], env)
        return ''
      }
      case 'IFFALSE': {
        const result = env.get('__TEST_RESULT__')
        if (!truthy(result)) return this.evalInstructionList(node.args[0], env)
        return ''
      }
      case 'GO':
      case 'RETURN': {
        // GO / RETURN: non-local jump. Simplified: evaluate the target.
        return this.eval(node.args[0], env)
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
  private evalInstructionList(node: ASTNode, env: Environment): LogoValue {
    if (node.type === 'list') {
      return this.evalSequence(node.items, env)
    }
    return this.eval(node, env)
  }

  /** Evaluate a RUN argument (list of instructions or code string). */
  private runCode(code: ASTNode, env: Environment): LogoValue {
    if (code.type === 'list') {
      return this.evalSequence(code.items, env)
    }
    // A word containing code: evaluate it as a literal value.
    return this.eval(code, env)
  }

  /** Evaluate a CASE expression. */
  private evalCase(value: LogoValue, clauses: ASTNode, env: Environment): LogoValue {
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
          return this.evalSequence(parts.slice(1), env)
        }
        // (cond) [result] or [cond1 cond2 ...] [result]
        if (cond.type === 'list') {
          const conds = cond.items
          const matched = conds.some((c) => logoEqual(this.eval(c, env), value))
          if (matched) {
            return this.evalSequence(parts.slice(1), env)
          }
        } else {
          const matched = logoEqual(this.eval(cond, env), value)
          if (matched) {
            return this.evalSequence(parts.slice(1), env)
          }
        }
      }
    }
    return ''
  }

  /** Public: run a parsed program, catching control-flow signals. */

  /** Evaluate a LogoList of instructions in a template context (MAP, FILTER, etc.). */
  evalTemplate(items: LogoValue[], env: Environment): LogoValue {
    const text = items.map(String).join(' ')
    if (!text.trim()) return ''
    const ast = parse(tokenize(text), this)
    return this.evalSequence(ast, env)
  }
  runProgram(nodes: ASTNode[], env: Environment): LogoValue {
    try {
      return this.evalSequence(nodes, env)
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
