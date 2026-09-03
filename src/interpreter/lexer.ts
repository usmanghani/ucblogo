/**
 * Logo tokenizer.
 *
 * Logo tokenization is space-delimited with special characters:
 *   - `"word`   quoted literal word
 *   - `"|a b|`  quoted word containing spaces / delimiters (barred)
 *   - `` `text` ``  backquoted word (Terrapin: a word with spaces)
 *   - `:var`    variable reference
 *   - `;`       comment to end of line
 *   - `~`       at end of line: continue the instruction on the next line
 *   - `[ ]`     list delimiters
 *   - `{ }`     array delimiters
 *   - `( )`     grouping / explicit arity
 *   - `+ - * / = <> < > <= >=`  infix operators
 *   - `TO` ... `END`  procedure definition
 *
 * Line ends are emitted as NEWLINE tokens: an instruction ends at the end of a
 * line unless we're inside brackets or parentheses, and constructs such as
 * `IF ... THEN ...` and `TO name :param` extend to the end of the line.
 */

export type TokenType =
  | 'WORD' // bare word (procedure name or literal)
  | 'NUMBER' // numeric literal
  | 'STRING' // quoted word ("foo, "|foo bar|, `foo bar`)
  | 'VARREF' // variable reference (:foo)
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'LBRACE' // {
  | 'RBRACE' // }
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'OP' // infix operator
  | 'NEWLINE' // end of a physical line (not emitted after `~`)
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  line: number
  col: number
  /** For OP '-': preceded by whitespace and followed by a non-space (UCBLogo unary minus). */
  unary?: boolean
}

const OPERATORS: Record<string, true> = {
  '+': true,
  '-': true,
  '*': true,
  '/': true,
  '=': true,
  '<>': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
}

/** True if the character is Logo whitespace (space or tab). */
function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t'
}

/**
 * Tokenize a Logo source string into tokens.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1
  const n = source.length

  function peek(offset = 0): string {
    return source[i + offset] ?? ''
  }

  function advance(): string {
    const ch = source[i]
    i++
    if (ch === '\n') {
      line++
      col = 1
    } else {
      col++
    }
    return ch
  }

  function pushNewline(): void {
    // Collapse runs of newlines; never start with one.
    const last = tokens[tokens.length - 1]
    if (last && last.type !== 'NEWLINE') tokens.push({ type: 'NEWLINE', value: '\n', line, col })
  }

  /** Read a word body, honouring `|...|` sections (which may contain anything). */
  function readWordBody(quoted = false): string {
    let word = ''
    while (i < n) {
      const ch = peek()
      if (ch === '|') {
        advance()
        while (i < n && peek() !== '|') word += advance()
        if (i < n) advance() // closing |
        continue
      }
      if (isSpace(ch) || ch === '\n' || ch === '\r') break
      if (quoted ? isQuotedDelimiter(ch) : isDelimiter(ch)) break
      // A tilde at end of line inside a word is a continuation marker.
      if (ch === '~' && isLineEndAfter(i + 1)) break
      word += advance()
    }
    return word
  }

  function isLineEndAfter(pos: number): boolean {
    let j = pos
    while (j < n && isSpace(source[j])) j++
    return j >= n || source[j] === '\n' || source[j] === '\r'
  }

  while (i < n) {
    const ch = peek()

    // Line continuation: `~` (UCBLogo) or `\` (Terrapin) followed by end of line.
    if ((ch === '~' || ch === '\\') && isLineEndAfter(i + 1)) {
      while (i < n && peek() !== '\n') advance()
      if (i < n) advance()
      continue
    }

    if (ch === '\n') {
      advance()
      pushNewline()
      continue
    }
    if (isSpace(ch) || ch === '\r') {
      advance()
      continue
    }

    // Comment: ; to end of line
    if (ch === ';') {
      while (i < n && peek() !== '\n') advance()
      continue
    }

    // Delimiters
    if (ch === '[') { tokens.push({ type: 'LBRACKET', value: '[', line, col }); advance(); continue }
    if (ch === ']') { tokens.push({ type: 'RBRACKET', value: ']', line, col }); advance(); continue }
    if (ch === '{') { tokens.push({ type: 'LBRACE', value: '{', line, col }); advance(); continue }
    if (ch === '}') { tokens.push({ type: 'RBRACE', value: '}', line, col }); advance(); continue }
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(', line, col }); advance(); continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')', line, col }); advance(); continue }

    // Infix operators (longest match first)
    const twoChar = ch + peek(1)
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>') {
      tokens.push({ type: 'OP', value: twoChar, line, col })
      advance()
      advance()
      continue
    }
    // Signed number: -3 or +3 immediately followed by a digit. Following
    // UCBLogo, a minus preceded by whitespace and not followed by whitespace is
    // unary, so `FD -3` and `:x -3` yield numbers while `:x-3` and `:x - 3`
    // are infix subtraction.
    if ((ch === '-' || ch === '+') && /[\d.]/.test(peek(1)) && /\d/.test(peek(1) === '.' ? peek(2) : peek(1))) {
      const prev = tokens[tokens.length - 1]
      const prevIsOperand = prev && (prev.type === 'NUMBER' || prev.type === 'VARREF' || prev.type === 'RPAREN' || prev.type === 'RBRACKET' || prev.type === 'STRING' || prev.type === 'WORD')
      const spaceBefore = i === 0 || isSpace(source[i - 1]) || source[i - 1] === '\n' || source[i - 1] === '[' || source[i - 1] === '('
      if (!prevIsOperand || spaceBefore) {
        const startLine = line
        const startCol = col
        let word = ch
        advance()
        while (i < n && /[\d.eE]/.test(peek())) word += advance()
        tokens.push({ type: 'NUMBER', value: word, line: startLine, col: startCol })
        continue
      }
    }
    if (OPERATORS[ch]) {
      const spaceBefore = i === 0 || isSpace(source[i - 1]) || source[i - 1] === '\n' || source[i - 1] === '[' || source[i - 1] === '('
      const next = peek(1)
      const unary = ch === '-' && spaceBefore && next !== '' && !isSpace(next) && next !== '\n' && next !== '\r'
      tokens.push(unary ? { type: 'OP', value: ch, line, col, unary: true } : { type: 'OP', value: ch, line, col })
      advance()
      continue
    }

    // Quoted word: "foo or "|foo bar|
    if (ch === '"') {
      const startLine = line
      const startCol = col
      advance() // consume "
      const word = readWordBody(true)
      tokens.push({ type: 'STRING', value: word, line: startLine, col: startCol })
      continue
    }

    // Backquoted word: `text with spaces`
    if (ch === '`') {
      const startLine = line
      const startCol = col
      advance()
      let word = ''
      while (i < n && peek() !== '`' && peek() !== '\n') word += advance()
      if (peek() === '`') advance()
      tokens.push({ type: 'STRING', value: word, line: startLine, col: startCol })
      continue
    }

    // Barred word on its own: |foo bar| (a literal word)
    if (ch === '|') {
      const startLine = line
      const startCol = col
      const word = readWordBody()
      tokens.push({ type: 'STRING', value: word, line: startLine, col: startCol })
      continue
    }

    // Variable reference: :foo
    if (ch === ':') {
      const startLine = line
      const startCol = col
      advance() // consume :
      const word = readWordBody()
      tokens.push({ type: 'VARREF', value: word, line: startLine, col: startCol })
      continue
    }

    // Bare word or number: read until whitespace or delimiter
    const startLine = line
    const startCol = col
    const word = readWordBody()

    if (word === '') {
      // Unhandled character; consume to avoid infinite loop.
      advance()
      continue
    }

    if (isNumericToken(word)) {
      tokens.push({ type: 'NUMBER', value: word, line: startLine, col: startCol })
    } else {
      tokens.push({ type: 'WORD', value: word, line: startLine, col: startCol })
    }
  }

  tokens.push({ type: 'EOF', value: '', line, col })
  return tokens
}

/** Delimiters that terminate a bare word. */
function isDelimiter(ch: string): boolean {
  return (
    ch === '[' ||
    ch === ']' ||
    ch === '{' ||
    ch === '}' ||
    ch === '(' ||
    ch === ')' ||
    ch === '"' ||
    ch === ':' ||
    ch === ';' ||
    ch === '+' ||
    ch === '-' ||
    ch === '*' ||
    ch === '/' ||
    ch === '=' ||
    ch === '<' ||
    ch === '>'
  )
}

/** Delimiters that terminate a quoted word (operators are allowed inside). */
function isQuotedDelimiter(ch: string): boolean {
  return ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === '(' || ch === ')'
}

/** True if a bare token is a numeric literal. */
function isNumericToken(word: string): boolean {
  if (word === '') return false
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(word)
}
