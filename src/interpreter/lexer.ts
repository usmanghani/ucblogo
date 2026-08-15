/**
 * Logo tokenizer.
 *
 * Logo tokenization is space-delimited with special characters:
 *   - `"word`   quoted literal word
 *   - `:var`    variable reference
 *   - `;`       comment to end of line
 *   - `[ ]`     list delimiters
 *   - `{ }`     array delimiters
 *   - `( )`     grouping / explicit arity
 *   - `+ - * / = <> < > <= >=`  infix operators
 *   - `TO` ... `END`  procedure definition
 */

export type TokenType =
  | 'WORD' // bare word (procedure name or literal)
  | 'NUMBER' // numeric literal
  | 'STRING' // quoted word ("foo)
  | 'VARREF' // variable reference (:foo)
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'LBRACE' // {
  | 'RBRACE' // }
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'OP' // infix operator
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  line: number
  col: number
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
 *
 * Newlines are significant only for `TO ... END` blocks and comments; the
 * parser treats them as separators. We preserve line/col for error reporting.
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

  while (i < n) {
    const ch = peek()

    // Whitespace
    if (isSpace(ch) || ch === '\n' || ch === '\r') {
      advance()
      continue
    }

    // Comment: ; to end of line
    if (ch === ';') {
      while (i < n && peek() !== '\n') advance()
      continue
    }

    // Delimiters
    if (ch === '[') {
      tokens.push({ type: 'LBRACKET', value: '[', line, col })
      advance()
      continue
    }
    if (ch === ']') {
      tokens.push({ type: 'RBRACKET', value: ']', line, col })
      advance()
      continue
    }
    if (ch === '{') {
      tokens.push({ type: 'LBRACE', value: '{', line, col })
      advance()
      continue
    }
    if (ch === '}') {
      tokens.push({ type: 'RBRACE', value: '}', line, col })
      advance()
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', line, col })
      advance()
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', line, col })
      advance()
      continue
    }

    // Infix operators (longest match first)
    const twoChar = ch + peek(1)
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>') {
      tokens.push({ type: 'OP', value: twoChar, line, col })
      advance()
      advance()
      continue
    }
    // Signed number: -3 or +3 immediately followed by a digit (no space).
    if ((ch === '-' || ch === '+') && /\d/.test(peek(1))) {
      const startLine = line
      const startCol = col
      let word = ch
      advance()
      while (i < n && /[\d.eE+-]/.test(peek()) && !isSpace(peek()) && !isDelimiter(peek()) && peek() !== '\n') {
        word += advance()
      }
      tokens.push({ type: 'NUMBER', value: word, line: startLine, col: startCol })
      continue
    }
    if (OPERATORS[ch]) {
      tokens.push({ type: 'OP', value: ch, line, col })
      advance()
      continue
    }

    // Quoted word: "foo
    if (ch === '"') {
      const startLine = line
      const startCol = col
      advance() // consume "
      let word = ''
      while (i < n && !isSpace(peek()) && !isDelimiter(peek()) && peek() !== '\n') {
        word += advance()
      }
      tokens.push({ type: 'STRING', value: word, line: startLine, col: startCol })
      continue
    }

    // Variable reference: :foo
    if (ch === ':') {
      const startLine = line
      const startCol = col
      advance() // consume :
      let word = ''
      while (i < n && !isSpace(peek()) && !isDelimiter(peek()) && peek() !== '\n') {
        word += advance()
      }
      tokens.push({ type: 'VARREF', value: word, line: startLine, col: startCol })
      continue
    }

    // Bare word or number: read until whitespace or delimiter
    const startLine = line
    const startCol = col
    let word = ''
    while (i < n && !isSpace(peek()) && !isDelimiter(peek()) && peek() !== '\n') {
      word += advance()
    }

    if (word === '') {
      // Unhandled character; consume to avoid infinite loop.
      advance()
      continue
    }

    // Determine if it's a number.
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
    ch === ':'
  )
}

/** True if a bare token is a numeric literal. */
function isNumericToken(word: string): boolean {
  if (word === '') return false
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(word)
}
