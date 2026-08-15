/**
 * Logo parser.
 *
 * Logo parsing is arity-aware: when the parser sees a procedure name, it must
 * know how many arguments to read. Primitives use PRIMITIVE_ARITY; user
 * procedures register their arity when their `TO ... END` block is parsed.
 *
 * Infix operators have precedence:
 *   * /  = 5
 *   + -  = 4
 *   = <> < > <= >= = 3
 *   AND  = 2
 *   OR   = 1
 */

import type { Token } from './lexer'
import { PRIMITIVE_ARITY, VARIABLE_ARITY } from './arity'
import { LogoError } from './errors'

export type ASTNode =
  | LiteralNode
  | VarRefNode
  | ListNode
  | ArrayNode
  | ProcCallNode
  | ProcDefNode
  | InfixNode

export interface LiteralNode {
  type: 'literal'
  value: number | string | boolean
}

export interface VarRefNode {
  type: 'varref'
  name: string
}

export interface ListNode {
  type: 'list'
  items: ASTNode[]
}

export interface ArrayNode {
  type: 'array'
  items: ASTNode[]
}

export interface ProcCallNode {
  type: 'call'
  name: string
  args: ASTNode[]
  line: number
  col: number
}

export interface ProcDefNode {
  type: 'procdef'
  name: string
  params: string[]
  /** Raw body text, parsed lazily at call time so forward references resolve. */
  bodyTokens: Token[]
  isMacro: boolean
  text: string
}

export interface InfixNode {
  type: 'infix'
  op: string
  left: ASTNode
  right: ASTNode
}

const INFIX_PRECEDENCE: Record<string, number> = {
  '*': 5, '/': 5,
  '+': 4, '-': 4,
  '=': 3, '<>': 3, '<': 3, '>': 3, '<=': 3, '>=': 3,
  AND: 2,
  OR: 1,
}

/** Interface the parser uses to look up user-defined procedure arity. */
export interface AritySource {
  getProcArity(name: string): number | undefined
}

/**
 * Parse a token stream into a list of AST statements.
 *
 * `aritySource` provides arity for user-defined procedures; primitives use the
 * built-in table. If null, only primitive arities are known.
 */
export function parse(tokens: Token[], aritySource?: AritySource): ASTNode[] {
  const parser = new Parser(tokens, aritySource)
  return parser.parseProgram()
}

class Parser {
  private tokens: Token[]
  private pos = 0
  private aritySource?: AritySource
  /** Arity of procedures defined via TO in this source (pre-scanned for forward refs). */
  private localArity = new Map<string, number>()

  constructor(tokens: Token[], aritySource?: AritySource) {
    this.tokens = tokens
    this.aritySource = aritySource
    this.prescanProcHeaders()
  }

  /** Scan all TO ... END headers to register local procedure arities before parsing bodies. */
  private prescanProcHeaders(): void {
    let i = 0
    while (i < this.tokens.length) {
      const tok = this.tokens[i]
      if (tok.type === 'WORD' && tok.value.toUpperCase() === 'TO') {
        // Next token is the procedure name.
        const nameTok = this.tokens[i + 1]
        if (nameTok && nameTok.type === 'WORD') {
          const name = nameTok.value.toUpperCase()
          // Count VARREF params until a non-VARREF token.
          let params = 0
          let j = i + 2
          while (j < this.tokens.length && this.tokens[j].type === 'VARREF') {
            params++
            j++
          }
          this.localArity.set(name, params)
        }
        // Skip to the matching END.
        let depth = 0
        let k = i
        while (k < this.tokens.length) {
          const t = this.tokens[k]
          if (t.type === 'LBRACKET') depth++
          else if (t.type === 'RBRACKET') depth--
          else if (t.type === 'WORD' && t.value.toUpperCase() === 'END' && depth === 0) {
            i = k
            break
          }
          k++
        }
      }
      i++
    }
  }

  private peek(offset = 0): Token {
    const idx = Math.min(this.pos + offset, this.tokens.length - 1)
    return this.tokens[idx]
  }

  private next(): Token {
    const t = this.tokens[this.pos]
    if (this.pos < this.tokens.length - 1) this.pos++
    return t
  }

  private atEnd(): boolean {
    return this.peek().type === 'EOF'
  }

  /** Parse a full program (sequence of top-level statements). */
  parseProgram(): ASTNode[] {
    const nodes: ASTNode[] = []
    while (!this.atEnd()) {
      const node = this.parseStatement()
      if (node) nodes.push(node)
    }
    return nodes
  }

  /** Parse a single top-level statement. */
  private parseStatement(): ASTNode | null {
    const tok = this.peek()
    if (tok.type === 'EOF') return null

    // TO ... END procedure definition
    if (tok.type === 'WORD' && tok.value.toUpperCase() === 'TO') {
      return this.parseProcDef()
    }

    return this.parseExpression(0)
  }

  /** Parse a `TO name :param ...` ... `END` procedure definition. */
  private parseProcDef(): ProcDefNode {
    const startTok = this.next() // consume TO
    const nameTok = this.next()
    if (nameTok.type !== 'WORD') {
      throw new LogoError('TO needs a procedure name', 'SYNTAX', startTok.line)
    }
    const name = nameTok.value.toUpperCase()

    // Parse parameters (VARREF tokens) until a non-parameter token.
    const params: string[] = []
    while (this.peek().type === 'VARREF') {
      params.push(this.next().value)
    }

    // Collect raw body tokens between header and END for lazy parsing at call
    // time. The body is not parsed now so that forward references to
    // procedures defined in later REPL submissions resolve correctly.
    const bodyStart = this.pos
    let depth = 0
    let isMacro = false
    while (!this.atEnd()) {
      const t = this.peek()
      if (t.type === 'LBRACKET') depth++
      else if (t.type === 'RBRACKET') depth--
      else if (t.type === 'WORD' && t.value.toUpperCase() === 'END' && depth === 0) break
      this.next()
    }
    const bodyTokens = this.tokens.slice(bodyStart, this.pos)

    // Consume END if present.
    if (this.peek().type === 'WORD' && this.peek().value.toUpperCase() === 'END') {
      this.next()
    }

    // Reconstruct original text for PO / TEXT.
    const text = this.tokens
      .slice(0, this.pos)
      .map((t) => t.value)
      .join(' ')

    return {
      type: 'procdef',
      name,
      params,
      bodyTokens,
      isMacro,
      text,
    }
  }

  /** Parse an expression, handling infix operators with precedence. */
  private parseExpression(minPrec: number): ASTNode | null {
    let left = this.parsePrimary()
    if (!left) return null

    while (true) {
      const tok = this.peek()
      if (tok.type === 'OP') {
        const prec = INFIX_PRECEDENCE[tok.value]
        if (prec === undefined || prec < minPrec) break
        this.next()
        const right = this.parseExpression(prec + 1)
        if (!right) {
          throw new LogoError(`${tok.value} needs a right operand`, 'SYNTAX', tok.line)
        }
        left = { type: 'infix', op: tok.value, left, right }
        continue
      }
      // Word operators: AND / OR appear as WORD tokens.
      if (tok.type === 'WORD' && (tok.value === 'AND' || tok.value === 'OR')) {
        const prec = INFIX_PRECEDENCE[tok.value]
        if (prec < minPrec) break
        this.next()
        const right = this.parseExpression(prec + 1)
        if (!right) {
          throw new LogoError(`${tok.value} needs a right operand`, 'SYNTAX', tok.line)
        }
        left = { type: 'infix', op: tok.value, left, right }
        continue
      }
      break
    }

    return left
  }

  /** Parse a primary expression (literal, list, array, varref, or call). */
  private parsePrimary(): ASTNode | null {
    const tok = this.peek()

    switch (tok.type) {
      case 'NUMBER':
        this.next()
        return { type: 'literal', value: parseFloat(tok.value) }

      case 'STRING':
        this.next()
        return { type: 'literal', value: tok.value }

      case 'VARREF':
        this.next()
        return { type: 'varref', name: tok.value }

      case 'LBRACKET': {
        this.next()
        const items: ASTNode[] = []
        while (this.peek().type !== 'RBRACKET') {
          if (this.atEnd()) throw new LogoError('Unclosed [', 'SYNTAX', tok.line)
          const item = this.parseExpression(0)
          if (item) items.push(item)
        }
        this.next() // consume ]
        return { type: 'list', items }
      }

      case 'LBRACE': {
        this.next()
        const items: ASTNode[] = []
        while (this.peek().type !== 'RBRACE') {
          if (this.atEnd()) throw new LogoError('Unclosed {', 'SYNTAX', tok.line)
          const item = this.parseExpression(0)
          if (item) items.push(item)
        }
        this.next() // consume }
        return { type: 'array', items }
      }

      case 'LPAREN': {
        // Parenthesized expression: either explicit-arity call or grouping.
        this.next()
        const inner = this.parseExpression(0)
        if (this.peek().type === 'RPAREN') {
          this.next()
          return inner
        }
        // Explicit-arity call: (NAME arg1 arg2 ...)
        if (inner && inner.type === 'call') {
          const args = [inner.args[0]]
          while (this.peek().type !== 'RPAREN') {
            if (this.atEnd()) throw new LogoError('Unclosed (', 'SYNTAX', tok.line)
            const arg = this.parseExpression(0)
            if (arg) args.push(arg)
          }
          this.next() // consume )
          return { ...inner, args }
        }
        throw new LogoError('Malformed ( ) expression', 'SYNTAX', tok.line)
      }

      case 'WORD': {
        const name = tok.value.toUpperCase()
        this.next()
        return this.parseCall(name, tok.line, tok.col)
      }

      case 'OP': {
        // Unary minus handled as a call to MINUS via -NUMBER.
        if (tok.value === '-') {
          this.next()
          const operand = this.parsePrimary()
          if (!operand) throw new LogoError('- needs an operand', 'SYNTAX', tok.line)
          return { type: 'call', name: 'MINUS', args: [operand], line: tok.line, col: tok.col }
        }
        throw new LogoError(`Unexpected operator ${tok.value}`, 'SYNTAX', tok.line)
      }

      case 'EOF':
        return null

      default:
        throw new LogoError(`Unexpected token ${tok.value}`, 'SYNTAX', tok.line)
    }
  }

  /** Parse a procedure call, reading `arity` arguments. */
  private parseCall(name: string, line: number, col: number): ASTNode {
    const arity = this.lookupArity(name)

    // If the name is not a known procedure and not a primitive, treat it as a
    // literal word (Logo's behavior for unknown words used as values).
    if (arity === undefined) {
      // Check if next token starts a call (e.g. it's followed by an argument
      // pattern). Logo defaults unknown words to literal words with arity 0.
      return { type: 'literal', value: name }
    }

    const args: ASTNode[] = []
    for (let i = 0; i < arity; i++) {
      const arg = this.parseExpression(0)
      if (!arg) {
        throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line)
      }
      args.push(arg)
    }

    return { type: 'call', name, args, line, col }
  }

  /** Look up the arity of a procedure (primitive or user-defined). */
  private lookupArity(name: string): number | undefined {
    const local = this.localArity.get(name)
    if (local !== undefined) return local
    if (this.aritySource) {
      const a = this.aritySource.getProcArity(name)
      if (a !== undefined) return a
    }
    return PRIMITIVE_ARITY[name]
  }
}

/** True if a name is a variable-arity primitive. */
export function isVariableArity(name: string): boolean {
  return !!VARIABLE_ARITY[name]
}
