/**
 * Logo parser.
 *
 * Logo parsing is arity-aware: when the parser sees a procedure name, it must
 * know how many arguments to read. Primitives use PRIMITIVE_ARITY; user
 * procedures register their arity when their `TO ... END` block is parsed.
 *
 * Lists (`[ ... ]`) are *data*: their contents are kept as raw tokens and only
 * parsed as instructions when something runs them (IF, REPEAT, RUN, ...).
 *
 * Infix operators have precedence:
 *   * /  = 5
 *   + -  = 4
 *   = <> < > <= >= = 3
 *   AND  = 2
 *   OR   = 1
 *
 * An instruction ends at the end of its line unless we are inside brackets or
 * parentheses. Terrapin-style `IF cond THEN ... ELSE ...` extends to the end of
 * the line.
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

/** A data item inside a list literal. */
export type ListItem = number | string | ListNode | ArrayNode

export interface ListNode {
  type: 'list'
  /** Data items (words, numbers, nested lists). */
  items: ListItem[]
  /** Raw tokens between the brackets (for lazy instruction parsing). */
  tokens: Token[]
  /** Cached parsed instructions (set when the list is run as code). */
  compiled?: ASTNode[]
  /** Arity-source generation the cache was built for. */
  compiledGen?: number
  line: number
  col: number
}

export interface ArrayNode {
  type: 'array'
  items: ListItem[]
  tokens: Token[]
  line: number
  col: number
}

export interface ProcCallNode {
  type: 'call'
  name: string
  args: ASTNode[]
  line: number
  col: number
}

export interface OptionalParam {
  name: string
  /** Tokens of the default-value expression. */
  defaultTokens: Token[]
}

export interface ProcDefNode {
  type: 'procdef'
  name: string
  /** Required parameters. */
  params: string[]
  /** Optional parameters `[:name default]`. */
  optionalParams: OptionalParam[]
  /** Rest parameter `[:name]` collecting extra inputs as a list. */
  restParam?: string
  /** Default number of inputs (when given explicitly at the end of the header). */
  defaultArity?: number
  /** Raw body text, parsed lazily at call time so forward references resolve. */
  bodyTokens: Token[]
  isMacro: boolean
  text: string
  line: number
}

export interface InfixNode {
  type: 'infix'
  op: string
  left: ASTNode
  right: ASTNode
  line: number
  col: number
}

const INFIX_PRECEDENCE: Record<string, number> = {
  '*': 5, '/': 5,
  '+': 4, '-': 4,
  '=': 3, '<>': 3, '<': 3, '>': 3, '<=': 3, '>=': 3,
  AND: 2,
  OR: 1,
}

/** Two-input commands that alternatively take one [x y] list (Terrapin). */
const LIST_OR_PAIR: Record<string, true> = { SETXY: true }

/** Interface the parser uses to look up user-defined procedure arity. */
export interface AritySource {
  getProcArity(name: string): number | undefined
}

/** Header information for a `TO` line. */
export interface ProcHeader {
  name: string
  params: string[]
  optionalParams: OptionalParam[]
  restParam?: string
  defaultArity?: number
}

/** Default arity of a procedure header: explicit number, else required count. */
export function headerArity(h: { params: string[]; defaultArity?: number }): number {
  return h.defaultArity ?? h.params.length
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

/** Parse the tokens of a list literal as instructions. */
export function parseInstructionTokens(tokens: Token[], aritySource?: AritySource): ASTNode[] {
  const last = tokens[tokens.length - 1]
  const toks = [...tokens, { type: 'EOF', value: '', line: last?.line ?? 1, col: last?.col ?? 1 } as Token]
  return new Parser(toks, aritySource).parseProgram()
}

/** Make a list node from raw tokens (used to build lists from Logo values). */
export function makeListNode(tokens: Token[], line = 1, col = 1): ListNode {
  return { type: 'list', items: tokensToData(tokens), tokens, line, col }
}

/** Convert the raw tokens of a list body into data items. */
function tokensToData(tokens: Token[]): ListItem[] {
  const items: ListItem[] = []
  let i = 0
  const readGroup = (open: 'LBRACKET' | 'LBRACE', close: 'RBRACKET' | 'RBRACE'): Token[] => {
    // tokens[i] is the opener
    const start = tokens[i]
    let depth = 0
    const inner: Token[] = []
    while (i < tokens.length) {
      const t = tokens[i]
      if (t.type === open) depth++
      else if (t.type === close) {
        depth--
        if (depth === 0) { i++; return inner }
      }
      if (depth >= 1 && !(depth === 1 && t.type === open && t === start)) inner.push(t)
      i++
    }
    throw new LogoError(`Unclosed ${start.value}`, 'SYNTAX', start.line, start.col)
  }
  while (i < tokens.length) {
    const t = tokens[i]
    switch (t.type) {
      case 'NEWLINE':
      case 'EOF':
        i++
        break
      case 'NUMBER':
        items.push(parseFloat(t.value))
        i++
        break
      case 'LBRACKET': {
        const inner = readGroup('LBRACKET', 'RBRACKET')
        items.push({ type: 'list', items: tokensToData(inner), tokens: inner, line: t.line, col: t.col })
        break
      }
      case 'LBRACE': {
        const inner = readGroup('LBRACE', 'RBRACE')
        items.push({ type: 'array', items: tokensToData(inner), tokens: inner, line: t.line, col: t.col })
        break
      }
      case 'VARREF':
        items.push(':' + t.value)
        i++
        break
      case 'STRING':
        items.push('"' + t.value)
        i++
        break
      default:
        items.push(t.value)
        i++
    }
  }
  return items
}

class Parser {
  private tokens: Token[]
  private pos = 0
  private aritySource?: AritySource
  /** Arity of procedures defined via TO in this source (pre-scanned for forward refs). */
  private localArity = new Map<string, number>()
  /** Nesting depth of ( ) — newlines are insignificant inside. */
  private parenDepth = 0

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
      if (tok.type === 'WORD' && tok.value.toUpperCase() === 'TO' && (i === 0 || this.tokens[i - 1].type === 'NEWLINE')) {
        const nameTok = this.tokens[i + 1]
        if (nameTok && (nameTok.type === 'WORD' || nameTok.type === 'STRING')) {
          try {
            const header = parseHeaderTokens(this.tokens, i + 1, (w) => this.lookupArity(w) !== undefined)
            this.localArity.set(header.header.name, headerArity(header.header))
            i = findEnd(this.tokens, header.next, this.tokens[header.next]?.type !== 'NEWLINE')
            continue
          } catch {
            // Leave it to parseProcDef to report the error.
          }
        }
        i = findEnd(this.tokens, i + 1)
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

  /** Skip newline tokens (between statements, or inside groups). */
  private skipNewlines(): void {
    while (this.peek().type === 'NEWLINE') this.next()
  }

  /** True if the next token ends the current instruction. */
  private atInstructionEnd(): boolean {
    const t = this.peek()
    if (t.type === 'EOF') return true
    if (t.type === 'NEWLINE') return this.parenDepth === 0
    if (t.type === 'RPAREN' || t.type === 'RBRACKET' || t.type === 'RBRACE') return true
    return false
  }

  /** Parse a full program (sequence of top-level statements). */
  parseProgram(): ASTNode[] {
    const nodes: ASTNode[] = []
    while (true) {
      this.skipNewlines()
      if (this.atEnd()) break
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
    if (tok.type === 'RPAREN' || tok.type === 'RBRACKET' || tok.type === 'RBRACE') {
      this.next()
      throw new LogoError(`Unexpected ${tok.value}`, 'SYNTAX', tok.line, tok.col)
    }
    return this.parseExpression(0)
  }

  /** Parse a `TO name :param ...` ... `END` procedure definition. */
  private parseProcDef(): ProcDefNode {
    const headerStart = this.pos
    const startTok = this.next() // consume TO
    const nameTok = this.peek()
    if (nameTok.type !== 'WORD' && nameTok.type !== 'STRING') {
      throw new LogoError('TO needs a procedure name', 'SYNTAX', startTok.line, startTok.col)
    }
    const { header, next } = parseHeaderTokens(this.tokens, this.pos, (w) => this.lookupArity(w) !== undefined)
    this.pos = next
    let oneLiner = false
    if (this.peek().type === 'NEWLINE') this.next()
    else oneLiner = true // body starts on the header line

    // Collect raw body tokens between header and END for lazy parsing at call
    // time. The body is not parsed now so that forward references to
    // procedures defined in later REPL submissions resolve correctly.
    const bodyStart = this.pos
    const endPos = findEnd(this.tokens, this.pos, oneLiner)
    this.pos = endPos
    const bodyTokens = this.tokens.slice(bodyStart, this.pos)

    // Consume END if present.
    if (this.peek().type === 'WORD' && this.peek().value.toUpperCase() === 'END') {
      this.next()
    }

    // Reconstruct original text for PO / TEXT.
    const text = tokensToText(this.tokens.slice(headerStart, this.pos))

    return {
      type: 'procdef',
      name: header.name,
      params: header.params,
      optionalParams: header.optionalParams,
      restParam: header.restParam,
      defaultArity: header.defaultArity,
      bodyTokens,
      isMacro: false,
      text,
      line: startTok.line,
    }
  }

  /** Parse an expression, handling infix operators with precedence. */
  private parseExpression(minPrec: number): ASTNode | null {
    let left = this.parsePrimary()
    if (!left) return null

    while (true) {
      const tok = this.peek()
      if (tok.type === 'OP') {
        if (tok.unary) break // `:x -:y` is two expressions, not subtraction
        const prec = INFIX_PRECEDENCE[tok.value]
        if (prec === undefined || prec < minPrec) break
        this.next()
        if (this.parenDepth > 0) this.skipNewlines()
        const right = this.parseExpression(prec + 1)
        if (!right) {
          throw new LogoError(`${tok.value} needs a right operand`, 'SYNTAX', tok.line, tok.col)
        }
        left = { type: 'infix', op: tok.value, left, right, line: tok.line, col: tok.col }
        continue
      }
      // Word operators: AND / OR appear as WORD tokens.
      if (tok.type === 'WORD') {
        const up = tok.value.toUpperCase()
        if (up === 'AND' || up === 'OR') {
          const prec = INFIX_PRECEDENCE[up]
          if (prec < minPrec) break
          this.next()
          if (this.parenDepth > 0) this.skipNewlines()
          const right = this.parseExpression(prec + 1)
          if (!right) {
            throw new LogoError(`${tok.value} needs a right operand`, 'SYNTAX', tok.line, tok.col)
          }
          left = { type: 'infix', op: up, left, right, line: tok.line, col: tok.col }
          continue
        }
      }
      break
    }

    return left
  }

  /** Read raw tokens up to the matching close delimiter (opener already consumed). */
  private readGroupTokens(open: Token, openType: 'LBRACKET' | 'LBRACE', closeType: 'RBRACKET' | 'RBRACE'): Token[] {
    const start = this.pos
    let depth = 1
    while (true) {
      const t = this.peek()
      if (t.type === 'EOF') throw new LogoError(`Unclosed ${open.value}`, 'SYNTAX', open.line, open.col)
      if (t.type === openType) depth++
      else if (t.type === closeType) {
        depth--
        if (depth === 0) break
      }
      this.next()
    }
    const inner = this.tokens.slice(start, this.pos)
    this.next() // consume closer
    return inner
  }

  /** Parse a primary expression (literal, list, array, varref, or call). */
  private parsePrimary(): ASTNode | null {
    if (this.parenDepth > 0) this.skipNewlines()
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
        const inner = this.readGroupTokens(tok, 'LBRACKET', 'RBRACKET')
        return { type: 'list', items: tokensToData(inner), tokens: inner, line: tok.line, col: tok.col }
      }

      case 'LBRACE': {
        this.next()
        const inner = this.readGroupTokens(tok, 'LBRACE', 'RBRACE')
        return { type: 'array', items: tokensToData(inner), tokens: inner, line: tok.line, col: tok.col }
      }

      case 'LPAREN': {
        this.next()
        this.parenDepth++
        try {
          this.skipNewlines()
          const first = this.peek()
          // Explicit-arity call: (NAME arg1 arg2 ...)
          const afterName = this.peek(1)
          const groupingAhead = afterName.type === 'OP' && !afterName.unary
          if (first.type === 'WORD' && !isInfixWord(first.value) && !groupingAhead && this.lookupArity(first.value.toUpperCase()) !== undefined) {
            this.next()
            const name = first.value.toUpperCase()
            const args: ASTNode[] = []
            while (true) {
              this.skipNewlines()
              if (this.peek().type === 'RPAREN') break
              if (this.atEnd()) throw new LogoError('Unclosed (', 'SYNTAX', tok.line, tok.col)
              const arg = this.parseExpression(0)
              if (!arg) throw new LogoError('Unclosed (', 'SYNTAX', tok.line, tok.col)
              args.push(arg)
            }
            this.next() // consume )
            return { type: 'call', name, args, line: first.line, col: first.col }
          }
          // Grouping: ( expr )
          const inner = this.parseExpression(0)
          this.skipNewlines()
          if (this.peek().type !== 'RPAREN') {
            const bad = this.peek()
            throw new LogoError(`Expected ) but found ${bad.type === 'EOF' ? 'end of input' : bad.value}`, 'SYNTAX', tok.line, tok.col)
          }
          this.next()
          if (!inner) throw new LogoError('Empty ( )', 'SYNTAX', tok.line, tok.col)
          return inner
        } finally {
          this.parenDepth--
        }
      }

      case 'WORD': {
        const name = tok.value.toUpperCase()
        this.next()
        return this.parseCall(name, tok.line, tok.col)
      }

      case 'OP': {
        // Unary minus handled as a call to MINUS.
        if (tok.value === '-') {
          this.next()
          const operand = this.parsePrimary()
          if (!operand) throw new LogoError('- needs an operand', 'SYNTAX', tok.line, tok.col)
          return { type: 'call', name: 'MINUS', args: [operand], line: tok.line, col: tok.col }
        }
        throw new LogoError(`Unexpected operator ${tok.value}`, 'SYNTAX', tok.line, tok.col)
      }

      case 'NEWLINE':
      case 'EOF':
        return null

      default:
        throw new LogoError(`Unexpected token ${tok.value}`, 'SYNTAX', tok.line, tok.col)
    }
  }

  /** Parse a procedure call, reading `arity` arguments. */
  private parseCall(name: string, line: number, col: number): ASTNode {
    if (name === 'IF' || name === 'IFELSE') {
      return this.parseIf(name, line, col)
    }
    if (name === 'TRUE') return { type: 'literal', value: true }
    if (name === 'FALSE') return { type: 'literal', value: false }
    if (name === 'FOR' && this.lookupArity(name) === 2 && this.localArity.get(name) === undefined) {
      return this.parseFor(line, col)
    }

    const arity = this.lookupArity(name)

    // If the name is not a known procedure and not a primitive, treat it as a
    // literal word (Logo's behavior for unknown words used as values). The
    // evaluator reports "I don't know how to" when it is run as a command.
    if (arity === undefined) {
      return { type: 'call', name, args: [], line, col }
    }

    const args: ASTNode[] = []
    for (let i = 0; i < arity; i++) {
      if (this.atInstructionEnd()) {
        if (VARIABLE_ARITY[name] && args.length > 0) break
        throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
      }
      const arg = this.parseExpression(0)
      if (!arg) {
        throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
      }
      args.push(arg)
      // SETXY / SETPOS-style commands also accept a single [x y] list.
      if (i === 0 && arity === 2 && LIST_OR_PAIR[name] && arg.type === 'list') break
    }

    return { type: 'call', name, args, line, col }
  }

  /**
   * Parse FOR in either form:
   *   FOR [var start stop step] [body]        (UCBLogo)
   *   FOR "var start stop [body]  (step)      (Terrapin / Apple Logo)
   */
  private parseFor(line: number, col: number): ASTNode {
    const first = this.parseArg('FOR', line, col)
    // Only a quoted word selects the Terrapin form; anything else is a
    // (possibly computed) [var start stop] list.
    if (!(first.type === 'literal' && typeof first.value === 'string')) {
      const body = this.parseArg('FOR', line, col)
      return { type: 'call', name: 'FOR', args: [first, body], line, col }
    }
    const start = this.parseArg('FOR', line, col)
    const stop = this.parseArg('FOR', line, col)
    const body = this.parseArg('FOR', line, col)
    const args: ASTNode[] = [first, start, stop, body]
    if (this.parenDepth > 0 && !this.atInstructionEnd()) args.push(this.parseArg('FOR', line, col))
    return { type: 'call', name: 'FOR', args, line, col }
  }

  private parseArg(name: string, line: number, col: number): ASTNode {
    if (this.atInstructionEnd()) throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
    const arg = this.parseExpression(0)
    if (!arg) throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
    return arg
  }

  /**
   * Parse IF / IFELSE, supporting both list form and the Terrapin/Apple Logo
   * `IF cond THEN instr... [ELSE instr...]` form which extends to end of line.
   */
  private parseIf(name: string, line: number, col: number): ASTNode {
    const cond = this.parseExpression(0)
    if (!cond) throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)

    const t = this.peek()
    if (t.type === 'WORD' && t.value.toUpperCase() === 'THEN') {
      this.next()
      const thenBlock = this.parseInlineBlock(t, ['ELSE'])
      let elseBlock: ListNode | null = null
      const e = this.peek()
      if (e.type === 'WORD' && e.value.toUpperCase() === 'ELSE') {
        this.next()
        elseBlock = this.parseInlineBlock(e, [])
      }
      if (elseBlock) return { type: 'call', name: 'IFELSE', args: [cond, thenBlock, elseBlock], line, col }
      return { type: 'call', name: 'IF', args: [cond, thenBlock], line, col }
    }

    // Terrapin also allows `IF cond instruction...` without THEN or brackets.
    if (name === 'IF' && !this.atInstructionEnd() && t.type !== 'LBRACKET' && t.type !== 'VARREF' && t.type !== 'LPAREN') {
      const thenBlock = this.parseInlineBlock(t, ['ELSE'])
      const e = this.peek()
      if (e.type === 'WORD' && e.value.toUpperCase() === 'ELSE') {
        this.next()
        const elseBlock = this.parseInlineBlock(e, [])
        return { type: 'call', name: 'IFELSE', args: [cond, thenBlock, elseBlock], line, col }
      }
      return { type: 'call', name: 'IF', args: [cond, thenBlock], line, col }
    }

    const args: ASTNode[] = [cond]
    const needed = name === 'IFELSE' ? 2 : 1
    for (let i = 0; i < needed; i++) {
      if (this.atInstructionEnd()) throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
      const arg = this.parseExpression(0)
      if (!arg) throw new LogoError(`${name} needs more inputs`, 'NEED_MORE_INPUTS', line, col)
      args.push(arg)
    }
    // `IF cond [then] [else]`: an extra list on the same line is the else branch.
    if (name === 'IF' && this.peek().type === 'LBRACKET') {
      const elseArg = this.parseExpression(0)
      if (elseArg) return { type: 'call', name: 'IFELSE', args: [...args, elseArg], line, col }
    }
    return { type: 'call', name, args, line, col }
  }

  /** Parse instructions up to end of line (or one of the stop words) into a pre-compiled list node. */
  private parseInlineBlock(at: Token, stopWords: string[]): ListNode {
    const nodes: ASTNode[] = []
    while (!this.atInstructionEnd()) {
      const t = this.peek()
      if (t.type === 'WORD' && stopWords.includes(t.value.toUpperCase())) break
      const node = this.parseExpression(0)
      if (!node) break
      nodes.push(node)
    }
    return { type: 'list', items: [], tokens: [], compiled: nodes, compiledGen: -1, line: at.line, col: at.col }
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

function isInfixWord(w: string): boolean {
  const up = w.toUpperCase()
  return up === 'AND' || up === 'OR'
}

/**
 * Parse a procedure header starting at `pos` (the name token). Returns the
 * header and the index of the first token after it (a NEWLINE or EOF).
 */
export function parseHeaderTokens(
  tokens: Token[],
  pos: number,
  isProcedure: (name: string) => boolean = () => false,
): { header: ProcHeader; next: number } {
  const nameTok = tokens[pos]
  const header: ProcHeader = { name: nameTok.value.toUpperCase(), params: [], optionalParams: [] }
  let i = pos + 1
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.type === 'NEWLINE' || t.type === 'EOF') break
    if (t.type === 'VARREF') {
      header.params.push(t.value)
      i++
      continue
    }
    if (t.type === 'WORD' && !isProcedure(t.value.toUpperCase()) && t.value.toUpperCase() !== 'END') {
      // Bare parameter name (Terrapin allows `TO FOO X`).
      header.params.push(t.value)
      i++
      continue
    }
    if (t.type === 'WORD' || t.type === 'STRING') break // body starts on the header line

    if (t.type === 'NUMBER') {
      header.defaultArity = parseInt(t.value, 10)
      i++
      continue
    }
    if (t.type === 'LBRACKET') {
      // [:name] rest parameter, or [:name default-expr] optional parameter.
      let j = i + 1
      const inner: Token[] = []
      let depth = 1
      while (j < tokens.length) {
        const u = tokens[j]
        if (u.type === 'LBRACKET') depth++
        if (u.type === 'RBRACKET') { depth--; if (depth === 0) break }
        inner.push(u)
        j++
      }
      if (j >= tokens.length) throw new LogoError('Unclosed [ in procedure header', 'SYNTAX', t.line, t.col)
      const pname = inner[0]
      if (!pname || (pname.type !== 'VARREF' && pname.type !== 'WORD')) {
        throw new LogoError('Bad optional parameter in procedure header', 'SYNTAX', t.line, t.col)
      }
      if (inner.length === 1) header.restParam = pname.value
      else header.optionalParams.push({ name: pname.value, defaultTokens: inner.slice(1) })
      i = j + 1
      continue
    }
    break // anything else: the body starts here (one-line definition)
  }
  return { header, next: i }
}

/** Find the index of the `END` token closing a procedure whose body starts at `from`. */
function findEnd(tokens: Token[], from: number, allowInlineEnd = false): number {
  let depth = 0
  let k = from
  while (k < tokens.length) {
    const t = tokens[k]
    if (t.type === 'LBRACKET' || t.type === 'LBRACE') depth++
    else if (t.type === 'RBRACKET' || t.type === 'RBRACE') depth = Math.max(0, depth - 1)
    else if (t.type === 'WORD' && t.value.toUpperCase() === 'END' && depth === 0 && (allowInlineEnd || k === 0 || tokens[k - 1].type === 'NEWLINE')) {
      return k
    }
    else if (t.type === 'EOF') return k
    k++
  }
  return k
}

/** Reconstruct readable source text from tokens. */
export function tokensToText(tokens: Token[]): string {
  let out = ''
  let prevType: string | null = null
  for (const t of tokens) {
    if (t.type === 'EOF') continue
    if (t.type === 'NEWLINE') { out += '\n'; prevType = 'NEWLINE'; continue }
    let text = t.value
    if (t.type === 'STRING') text = quoteWord(t.value)
    else if (t.type === 'VARREF') text = ':' + t.value
    const noSpace = prevType === null || prevType === 'NEWLINE' || prevType === 'LBRACKET' || prevType === 'LPAREN' || prevType === 'LBRACE'
      || t.type === 'RBRACKET' || t.type === 'RPAREN' || t.type === 'RBRACE'
    out += (noSpace ? '' : ' ') + text
    prevType = t.type
  }
  return out
}

/** Render a word as a quoted Logo literal, barring it when needed. */
export function quoteWord(w: string): string {
  if (w === '' || /[\s[\]{}()|;]/.test(w)) return '"|' + w + '|'
  return '"' + w
}

/** True if a name is a variable-arity primitive. */
export function isVariableArity(name: string): boolean {
  return !!VARIABLE_ARITY[name]
}
