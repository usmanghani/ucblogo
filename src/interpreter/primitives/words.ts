/**
 * Word (string) primitives.
 */

import type { Evaluator } from '../evaluator'
import type { LogoValue } from '../types'
import { isWord, isNumber, isList, LogoList, formatNumber } from '../types'
import { badInput } from '../errors'
import { tokenize } from '../lexer'
import { parse } from '../parser'

function word(v: LogoValue, name: string): string {
  if (isWord(v)) return v
  if (isNumber(v)) return formatNumber(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof LogoList && v.items.length === 0) return ''
  throw badInput(name, v)
}

/** Register all word primitives. */
export function registerWords(ev: Evaluator): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  reg('WORD', 0, 99, (args) => args.map((a) => word(a, 'WORD')).join(''))

  reg('CHAR', 1, 1, (args) => {
    const n = args[0]
    if (!isNumber(n) || !Number.isInteger(n)) throw badInput('CHAR', n)
    return String.fromCharCode(n)
  })

  reg('ASCII', 1, 1, (args) => {
    const w = word(args[0], 'ASCII')
    if (w.length === 0) throw badInput('ASCII', args[0])
    return w.charCodeAt(0)
  })

  reg('LOWERCASE', 1, 1, (args) => word(args[0], 'LOWERCASE').toLowerCase())
  reg('UPPERCASE', 1, 1, (args) => word(args[0], 'UPPERCASE').toUpperCase())

  reg('FORM', 2, 2, (args) => {
    const n = args[0]
    const w = args[1]
    if (!isNumber(n)) throw badInput('FORM', n)
    if (!isWord(w)) throw badInput('FORM', w)
    const width = parseInt(w, 10)
    if (isNaN(width)) throw badInput('FORM', w)
    return String(n).padStart(width, ' ')
  })

  reg('PARSE', 1, 1, (args) => {
    const w = word(args[0], 'PARSE')
    const tokens = tokenize(w)
    const ast = parse(tokens)
    return new LogoList(ast.map((node) => nodeToString(node)))
  })

  reg('UNPARSE', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return v.items.map((item) => String(item)).join(' ')
    return String(v)
  })

  reg('BACKSLASHEDP', 1, 1, (args) => {
    const w = word(args[0], 'BACKSLASHEDP')
    return w.startsWith('\\')
  })

  reg('SUBSTRING', 2, 3, (args) => {
    const s = word(args[0], 'SUBSTRING')
    const start = args[1]
    if (!isNumber(start)) throw badInput('SUBSTRING', start)
    const from = Math.trunc(start) - 1
    if (args.length === 3) {
      const end = args[2]
      if (!isNumber(end)) throw badInput('SUBSTRING', end)
      return s.slice(from, Math.trunc(end))
    }
    return s.slice(from)
  })

  reg('SUBSTRINGP', 2, 2, (args) => {
    const sub = word(args[0], 'SUBSTRINGP')
    const s = word(args[1], 'SUBSTRINGP')
    return s.includes(sub)
  })
}

/** Convert an AST node to a Logo string for PARSE. */
function nodeToString(node: unknown): string {
  const n = node as { type: string; value?: unknown; name?: string; args?: unknown[] }
  switch (n.type) {
    case 'literal':
      return String(n.value)
    case 'varref':
      return ':' + String(n.name)
    case 'call':
      return String(n.name)
    default:
      return String(n.value ?? n.name ?? '')
  }
}
