/**
 * Blockly code generator that emits Logo source.
 *
 * Every value is emitted fully parenthesised when it is composite, so Logo's
 * left-to-right, arity-driven parsing never has to guess where an input ends.
 * Statement blocks emit one instruction per line; instruction lists are
 * emitted as indented `[ ... ]` blocks.
 */

import * as Blockly from 'blockly'
import { PRIMITIVE_ARITY } from '../interpreter/arity'
import { defineLogoBlocks } from './logoBlocks'

type Block = Blockly.Block

export const ORDER_ATOMIC = 0
export const ORDER_NONE = 99

export class LogoGenerator extends Blockly.CodeGenerator {
  constructor() {
    super('Logo')
    this.INDENT = '  '
    this.addReservedWords(Object.keys(PRIMITIVE_ARITY).join(','))
    this.addReservedWords('TO,END,THEN,ELSE,TRUE,FALSE')
    this.isInitialized = false
    this.installBlocks()
  }

  init(workspace: Blockly.Workspace): void {
    super.init(workspace)
    if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_)
    else this.nameDB_.reset()
    this.nameDB_.setVariableMap(workspace.getVariableMap())
    this.nameDB_.populateVariables(workspace)
    this.nameDB_.populateProcedures(workspace)
    this.isInitialized = true
  }

  finish(code: string): string {
    // Procedure definitions first, then the top-level program.
    const defs = Object.values(this.definitions_ as Record<string, string>)
    this.nameDB_?.reset()
    const body = code.replace(/\n{3,}/g, '\n\n').trim()
    const parts = [...defs, body].filter((p) => p.trim() !== '')
    return parts.join('\n\n') + (parts.length ? '\n' : '')
  }

  /** Append the code of the following statement block. */
  scrub_(block: Block, code: string, thisOnly = false): string {
    const next = block.nextConnection && block.nextConnection.targetBlock()
    if (!thisOnly && next) return code + this.blockToCode(next)
    return code
  }

  scrubNakedValue(line: string): string {
    // A value block not attached to anything: show it, so nothing is lost.
    return `SHOW ${line}\n`
  }

  // --- Helpers -------------------------------------------------------------

  /** Value input code, or a default when the input is empty. */
  value(block: Block, name: string, fallback = '0'): string {
    const code = this.valueToCode(block, name, ORDER_NONE)
    return code === '' ? fallback : code
  }

  /** Statement input as an indented Logo instruction list. */
  list(block: Block, name: string): string {
    const body = this.statementToCode(block, name)
    if (body.trim() === '') return '[]'
    return `[\n${body}]`
  }

  /** Wrap composite value code in parentheses. */
  static paren(code: string): string {
    return `(${code})`
  }

  /** A Logo word literal for arbitrary text. */
  static quote(text: string): string {
    if (text === '') return '"||'
    if (/[\s[\]{}()|;]/.test(text)) return `"|${text}|`
    return `"${text}`
  }

  /** Sanitize a user-facing name into a Logo identifier. */
  static ident(name: string): string {
    const cleaned = name.trim().replace(/[^A-Za-z0-9_.?]+/g, '_').replace(/^_+|_+$/g, '')
    return (cleaned || 'item').toUpperCase()
  }

  varName(block: Block, field = 'VAR'): string {
    const id = block.getFieldValue(field)
    const name = this.getVariableName(id)
    return LogoGenerator.ident(name)
  }

  procName(name: string): string {
    return LogoGenerator.ident(this.getProcedureName(name))
  }

  // --- Block generators ----------------------------------------------------

  private installBlocks(): void {
    const fb = this.forBlock
    const P = LogoGenerator.paren
    const stmt = (code: string) => code + '\n'

    // Turtle
    fb['logo_move'] = (b) => stmt(`${b.getFieldValue('DIR')} ${this.value(b, 'DISTANCE')}`)
    fb['logo_turn'] = (b) => stmt(`${b.getFieldValue('DIR')} ${this.value(b, 'ANGLE')}`)
    fb['logo_home'] = () => stmt('HOME')
    fb['logo_setxy'] = (b) => stmt(`SETXY ${this.value(b, 'X')} ${this.value(b, 'Y')}`)
    fb['logo_setheading'] = (b) => stmt(`SETHEADING ${this.value(b, 'ANGLE')}`)
    fb['logo_arc'] = (b) => stmt(`ARC ${this.value(b, 'ANGLE')} ${this.value(b, 'RADIUS')}`)
    fb['logo_visibility'] = (b) => stmt(b.getFieldValue('MODE'))
    fb['logo_clearscreen'] = () => stmt('CLEARSCREEN')
    fb['logo_label'] = (b) => stmt(`LABEL ${this.value(b, 'TEXT', '"||')}`)
    fb['logo_wait'] = (b) => stmt(`WAIT ${this.value(b, 'MS')}`)
    fb['logo_query'] = (b) => [b.getFieldValue('WHAT'), ORDER_ATOMIC]
    fb['logo_towards'] = (b) => [P(`TOWARDS ${this.value(b, 'X')} ${this.value(b, 'Y')}`), ORDER_ATOMIC]

    // Pen
    fb['logo_pen'] = (b) => stmt(b.getFieldValue('MODE'))
    fb['logo_setpencolor'] = (b) => stmt(`SETPENCOLOR ${b.getFieldValue('COLOR')}`)
    fb['logo_setpencolor_value'] = (b) => stmt(`SETPENCOLOR ${this.value(b, 'COLOR')}`)
    fb['logo_rgb'] = (b) => [P(`LIST ${this.value(b, 'R')} ${this.value(b, 'G')} ${this.value(b, 'B')}`), ORDER_ATOMIC]
    fb['logo_setbackground'] = (b) => stmt(`SETBACKGROUND ${b.getFieldValue('COLOR')}`)
    fb['logo_setpensize'] = (b) => stmt(`SETPENSIZE ${this.value(b, 'SIZE', '1')}`)
    fb['logo_stamp'] = (b) => {
      const filled = b.getFieldValue('FILLED') === 'TRUE'
      return stmt(`(${b.getFieldValue('SHAPE')} ${this.value(b, 'W')} ${this.value(b, 'H')} ${filled ? '"TRUE' : '"FALSE'})`)
    }
    fb['logo_dot'] = (b) => stmt(`DOT ${this.value(b, 'SIZE', '1')}`)

    // I/O
    fb['logo_print'] = (b) => stmt(`${b.getFieldValue('MODE')} ${this.value(b, 'VALUE', '"||')}`)
    fb['logo_cleartext'] = () => stmt('CLEARTEXT')
    fb['logo_read'] = (b) => [b.getFieldValue('MODE'), ORDER_ATOMIC]
    fb['logo_stop'] = () => stmt('STOP')
    fb['logo_word'] = (b) => [LogoGenerator.quote(b.getFieldValue('TEXT')), ORDER_ATOMIC]

    // Lists
    fb['logo_list_part'] = (b) => [P(`${b.getFieldValue('PART')} ${this.value(b, 'LIST', '[]')}`), ORDER_ATOMIC]
    fb['logo_list_add'] = (b) => [P(`${b.getFieldValue('WHERE')} ${this.value(b, 'ITEM', '"||')} ${this.value(b, 'LIST', '[]')}`), ORDER_ATOMIC]
    fb['logo_pick'] = (b) => [P(`PICK ${this.value(b, 'LIST', '[]')}`), ORDER_ATOMIC]
    fb['logo_sentence'] = (b) => [P(`SENTENCE ${this.value(b, 'A', '[]')} ${this.value(b, 'B', '[]')}`), ORDER_ATOMIC]
    fb['logo_run'] = (b) => stmt(`RUN ${this.value(b, 'LIST', '[]')}`)

    // Standard Blockly: control
    fb['controls_repeat_ext'] = (b) => stmt(`REPEAT ${this.value(b, 'TIMES')} ${this.list(b, 'DO')}`)
    fb['controls_repeat'] = (b) => stmt(`REPEAT ${b.getFieldValue('TIMES')} ${this.list(b, 'DO')}`)
    fb['controls_if'] = (b) => {
      // if / else if ... / else  →  nested IFELSE chains.
      const branches: { cond: string; body: string }[] = []
      let n = 0
      while (b.getInput('IF' + n)) {
        branches.push({ cond: this.value(b, 'IF' + n, '"FALSE'), body: this.list(b, 'DO' + n) })
        n++
      }
      const hasElse = !!b.getInput('ELSE')
      const elseBody = hasElse ? this.list(b, 'ELSE') : null
      const build = (i: number): string => {
        const br = branches[i]
        const isLast = i === branches.length - 1
        if (isLast) {
          if (elseBody) return `IFELSE ${br.cond} ${br.body} ${elseBody}`
          return `IF ${br.cond} ${br.body}`
        }
        const rest = build(i + 1)
        const indented = rest.split('\n').map((l) => this.INDENT + l).join('\n')
        return `IFELSE ${br.cond} ${br.body} [\n${indented}\n]`
      }
      return stmt(build(0))
    }
    fb['controls_whileUntil'] = (b) => {
      const mode = b.getFieldValue('MODE') === 'UNTIL' ? 'UNTIL' : 'WHILE'
      return stmt(`${mode} [${this.value(b, 'BOOL', '"FALSE')}] ${this.list(b, 'DO')}`)
    }
    fb['controls_for'] = (b) => {
      const v = this.varName(b)
      const from = this.value(b, 'FROM', '1')
      const to = this.value(b, 'TO', '10')
      const by = this.value(b, 'BY', '1')
      const step = by === '1' ? '' : ` ${by}`
      return stmt(`FOR [${v} ${from} ${to}${step}] ${this.list(b, 'DO')}`)
    }
    fb['controls_forEach'] = (b) => {
      const v = this.varName(b)
      const body = this.statementToCode(b, 'DO')
      return stmt(`FOREACH ${this.value(b, 'LIST', '[]')} [\n${this.INDENT}MAKE "${v} ?\n${body}]`)
    }
    fb['controls_flow_statements'] = (b) => stmt(b.getFieldValue('FLOW') === 'BREAK' ? 'STOP' : '; continue is not available in Logo')

    // Logic
    fb['logic_compare'] = (b) => {
      const ops: Record<string, string> = { EQ: '=', NEQ: '<>', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
      return [P(`${this.value(b, 'A')} ${ops[b.getFieldValue('OP')] ?? '='} ${this.value(b, 'B')}`), ORDER_ATOMIC]
    }
    fb['logic_operation'] = (b) => {
      const op = b.getFieldValue('OP') === 'AND' ? 'AND' : 'OR'
      return [P(`${op} ${this.value(b, 'A', '"FALSE')} ${this.value(b, 'B', '"FALSE')}`), ORDER_ATOMIC]
    }
    fb['logic_negate'] = (b) => [P(`NOT ${this.value(b, 'BOOL', '"FALSE')}`), ORDER_ATOMIC]
    fb['logic_boolean'] = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? '"TRUE' : '"FALSE', ORDER_ATOMIC]
    fb['logic_null'] = () => ['[]', ORDER_ATOMIC]
    fb['logic_ternary'] = (b) => [P(`IFELSE ${this.value(b, 'IF', '"FALSE')} [${this.value(b, 'THEN', '[]')}] [${this.value(b, 'ELSE', '[]')}]`), ORDER_ATOMIC]

    // Math
    fb['math_number'] = (b) => {
      const n = Number(b.getFieldValue('NUM'))
      return [n < 0 ? P(String(n)) : String(n), ORDER_ATOMIC]
    }
    fb['math_arithmetic'] = (b) => {
      const op = b.getFieldValue('OP')
      const a = this.value(b, 'A')
      const c = this.value(b, 'B')
      if (op === 'POWER') return [P(`POWER ${a} ${c}`), ORDER_ATOMIC]
      const sym: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }
      return [P(`${a} ${sym[op] ?? '+'} ${c}`), ORDER_ATOMIC]
    }
    fb['math_single'] = (b) => {
      const op = b.getFieldValue('OP')
      const n = this.value(b, 'NUM')
      const map: Record<string, string> = { ROOT: 'SQRT', ABS: 'ABS', NEG: 'MINUS', LN: 'LN', LOG10: 'LOG10', EXP: 'EXP' }
      if (op === 'POW10') return [P(`POWER 10 ${n}`), ORDER_ATOMIC]
      return [P(`${map[op] ?? 'ABS'} ${n}`), ORDER_ATOMIC]
    }
    fb['math_trig'] = (b) => {
      const op = b.getFieldValue('OP')
      const n = this.value(b, 'NUM')
      switch (op) {
        case 'SIN': return [P(`SIN ${n}`), ORDER_ATOMIC]
        case 'COS': return [P(`COS ${n}`), ORDER_ATOMIC]
        case 'TAN': return [P(`(SIN ${n}) / (COS ${n})`), ORDER_ATOMIC]
        case 'ASIN': return [P(`ARCTAN ${n} (SQRT (1 - ${n} * ${n}))`), ORDER_ATOMIC]
        case 'ACOS': return [P(`90 - (ARCTAN ${n} (SQRT (1 - ${n} * ${n})))`), ORDER_ATOMIC]
        default: return [P(`ARCTAN ${n}`), ORDER_ATOMIC]
      }
    }
    fb['math_constant'] = (b) => {
      const c = b.getFieldValue('CONSTANT')
      const map: Record<string, string> = { PI: 'PI', E: '(EXP 1)', GOLDEN_RATIO: '((1 + SQRT 5) / 2)', SQRT2: '(SQRT 2)', SQRT1_2: '(SQRT 0.5)', INFINITY: '1e308' }
      return [map[c] ?? 'PI', ORDER_ATOMIC]
    }
    fb['math_round'] = (b) => {
      const op = b.getFieldValue('OP')
      const n = this.value(b, 'NUM')
      if (op === 'ROUNDUP') return [P(`MINUS INT MINUS ${n}`), ORDER_ATOMIC]
      if (op === 'ROUNDDOWN') return [P(`INT ${n}`), ORDER_ATOMIC]
      return [P(`ROUND ${n}`), ORDER_ATOMIC]
    }
    fb['math_modulo'] = (b) => [P(`REMAINDER ${this.value(b, 'DIVIDEND')} ${this.value(b, 'DIVISOR', '1')}`), ORDER_ATOMIC]
    fb['math_random_int'] = (b) => [P(`RANDOM ${this.value(b, 'FROM', '1')} ${this.value(b, 'TO', '10')}`), ORDER_ATOMIC]
    fb['math_random_float'] = () => [P('(RANDOM 1000000) / 1000000'), ORDER_ATOMIC]
    fb['math_number_property'] = (b) => {
      const n = this.value(b, 'NUMBER_TO_CHECK')
      switch (b.getFieldValue('PROPERTY')) {
        case 'EVEN': return [P(`(REMAINDER ${n} 2) = 0`), ORDER_ATOMIC]
        case 'ODD': return [P(`(REMAINDER ${n} 2) = 1`), ORDER_ATOMIC]
        case 'POSITIVE': return [P(`${n} > 0`), ORDER_ATOMIC]
        case 'NEGATIVE': return [P(`${n} < 0`), ORDER_ATOMIC]
        case 'WHOLE': return [P(`(INT ${n}) = ${n}`), ORDER_ATOMIC]
        case 'DIVISIBLE_BY': return [P(`(REMAINDER ${n} ${this.value(b, 'DIVISOR', '1')}) = 0`), ORDER_ATOMIC]
        default: return ['"FALSE', ORDER_ATOMIC]
      }
    }
    fb['math_change'] = (b) => {
      const v = this.varName(b)
      return stmt(`MAKE "${v} :${v} + ${this.value(b, 'DELTA', '1')}`)
    }

    // Text
    fb['text'] = (b) => [LogoGenerator.quote(b.getFieldValue('TEXT')), ORDER_ATOMIC]
    fb['text_join'] = (b) => {
      const n = (b as Block & { itemCount_: number }).itemCount_ ?? 0
      const parts: string[] = []
      for (let i = 0; i < n; i++) parts.push(this.value(b, 'ADD' + i, '"||'))
      if (parts.length === 0) return ['"||', ORDER_ATOMIC]
      if (parts.length === 1) return [parts[0], ORDER_ATOMIC]
      return [P(`WORD ${parts.join(' ')}`), ORDER_ATOMIC]
    }
    fb['text_length'] = (b) => [P(`COUNT ${this.value(b, 'VALUE', '"||')}`), ORDER_ATOMIC]
    fb['text_isEmpty'] = (b) => [P(`EMPTYP ${this.value(b, 'VALUE', '"||')}`), ORDER_ATOMIC]
    fb['text_print'] = (b) => stmt(`PRINT ${this.value(b, 'TEXT', '"||')}`)
    fb['text_changeCase'] = (b) => {
      const c = b.getFieldValue('CASE') === 'LOWERCASE' ? 'LOWERCASE' : 'UPPERCASE'
      return [P(`${c} ${this.value(b, 'TEXT', '"||')}`), ORDER_ATOMIC]
    }

    // Lists (standard)
    fb['lists_create_with'] = (b) => {
      const n = (b as Block & { itemCount_: number }).itemCount_ ?? 0
      const parts: string[] = []
      for (let i = 0; i < n; i++) parts.push(this.value(b, 'ADD' + i, '"||'))
      if (parts.length === 0) return ['[]', ORDER_ATOMIC]
      return [P(`LIST ${parts.join(' ')}`), ORDER_ATOMIC]
    }
    fb['lists_create_empty'] = () => ['[]', ORDER_ATOMIC]
    fb['lists_length'] = (b) => [P(`COUNT ${this.value(b, 'VALUE', '[]')}`), ORDER_ATOMIC]
    fb['lists_isEmpty'] = (b) => [P(`EMPTYP ${this.value(b, 'VALUE', '[]')}`), ORDER_ATOMIC]
    fb['lists_repeat'] = (b) => [P(`CASCADE ${this.value(b, 'NUM', '0')} [LPUT ${this.value(b, 'ITEM', '"||')} ?] []`), ORDER_ATOMIC]
    fb['lists_reverse'] = (b) => [P(`REVERSE ${this.value(b, 'LIST', '[]')}`), ORDER_ATOMIC]
    fb['lists_indexOf'] = (b) => [P(`FIND [? = ${this.value(b, 'FIND', '"||')}] ${this.value(b, 'VALUE', '[]')}`), ORDER_ATOMIC]
    fb['lists_getIndex'] = (b) => {
      const list = this.value(b, 'VALUE', '[]')
      const where = b.getFieldValue('WHERE')
      const at = this.value(b, 'AT', '1')
      switch (where) {
        case 'FIRST': return [P(`FIRST ${list}`), ORDER_ATOMIC]
        case 'LAST': return [P(`LAST ${list}`), ORDER_ATOMIC]
        case 'FROM_END': return [P(`ITEM ((COUNT ${list}) + 1 - ${at}) ${list}`), ORDER_ATOMIC]
        case 'RANDOM': return [P(`PICK ${list}`), ORDER_ATOMIC]
        default: return [P(`ITEM ${at} ${list}`), ORDER_ATOMIC]
      }
    }

    // Variables
    fb['variables_get'] = (b) => [`:${this.varName(b)}`, ORDER_ATOMIC]
    fb['variables_set'] = (b) => stmt(`MAKE "${this.varName(b)} ${this.value(b, 'VALUE')}`)

    // Procedures
    const defineProc = (b: Block, hasReturn: boolean): null => {
      const name = this.procName(b.getFieldValue('NAME'))
      const def = (b as Block & { getProcedureDef: () => [string, string[], boolean] }).getProcedureDef()
      const params = def[1].map((v) => ':' + LogoGenerator.ident(this.getVariableName(v)))
      let body = this.statementToCode(b, 'STACK')
      if (hasReturn) {
        const ret = this.valueToCode(b, 'RETURN', ORDER_NONE)
        if (ret) body += `${this.INDENT}OUTPUT ${ret}\n`
      }
      const header = ['TO', name, ...params].join(' ')
      this.definitions_['%' + name] = `${header}\n${body}END`
      return null
    }
    fb['procedures_defnoreturn'] = (b) => defineProc(b, false)
    fb['procedures_defreturn'] = (b) => defineProc(b, true)
    const callArgs = (b: Block): string[] => {
      const n = (b as Block & { arguments_?: string[] }).arguments_?.length ?? 0
      const args: string[] = []
      for (let i = 0; i < n; i++) args.push(this.value(b, 'ARG' + i, '"||'))
      return args
    }
    fb['procedures_callnoreturn'] = (b) => {
      const name = this.procName(b.getFieldValue('NAME'))
      const args = callArgs(b)
      return stmt(args.length ? `${name} ${args.join(' ')}` : name)
    }
    fb['procedures_callreturn'] = (b) => {
      const name = this.procName(b.getFieldValue('NAME'))
      const args = callArgs(b)
      return [args.length ? P(`${name} ${args.join(' ')}`) : name, ORDER_ATOMIC]
    }
    fb['procedures_ifreturn'] = (b) => {
      const cond = this.value(b, 'CONDITION', '"FALSE')
      const hasValue = (b as Block & { hasReturnValue_?: boolean }).hasReturnValue_
      if (hasValue) return stmt(`IF ${cond} [OUTPUT ${this.value(b, 'VALUE', '[]')}]`)
      return stmt(`IF ${cond} [STOP]`)
    }
  }
}

let shared: LogoGenerator | null = null

/** The shared generator instance (blocks are defined on first use). */
export function logoGenerator(): LogoGenerator {
  defineLogoBlocks()
  if (!shared) shared = new LogoGenerator()
  return shared
}

/** Generate Logo source for a workspace. */
export function workspaceToLogo(workspace: Blockly.Workspace): string {
  return logoGenerator().workspaceToCode(workspace)
}
