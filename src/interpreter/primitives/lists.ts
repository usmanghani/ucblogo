/**
 * List primitives.
 */

import type { Evaluator } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoList, isList, isWord, isArray, isNumber, logoEqual } from '../types'
import { badInput } from '../errors'

function list(v: LogoValue, name: string): LogoList {
  if (isList(v)) return v
  throw badInput(name, v)
}

function seq(v: LogoValue, name: string): LogoValue[] {
  if (isList(v)) return v.items
  if (isWord(v)) return v.split('')
  if (isArray(v)) return v.items
  throw badInput(name, v)
}

/** Register all list primitives. */
export function registerLists(ev: Evaluator): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  reg('FIRST', 1, 1, (args) => {
    const items = seq(args[0], 'FIRST')
    if (items.length === 0) throw badInput('FIRST', args[0])
    return items[0]
  })

  reg('LAST', 1, 1, (args) => {
    const items = seq(args[0], 'LAST')
    if (items.length === 0) throw badInput('LAST', args[0])
    return items[items.length - 1]
  })

  reg('BUTFIRST', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return new LogoList(v.items.slice(1))
    if (isWord(v)) return v.slice(1)
    throw badInput('BUTFIRST', v)
  })
  reg('BF', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return new LogoList(v.items.slice(1))
    if (isWord(v)) return v.slice(1)
    throw badInput('BF', v)
  })

  reg('BUTLAST', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return new LogoList(v.items.slice(0, -1))
    if (isWord(v)) return v.slice(0, -1)
    throw badInput('BUTLAST', v)
  })
  reg('BL', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return new LogoList(v.items.slice(0, -1))
    if (isWord(v)) return v.slice(0, -1)
    throw badInput('BL', v)
  })

  reg('FIRSTS', 1, 1, (args) => {
    const v = list(args[0], 'FIRSTS')
    return new LogoList(v.items.map((item) => {
      const s = seq(item, 'FIRSTS')
      return s.length > 0 ? s[0] : ''
    }))
  })

  reg('BUTFIRSTS', 1, 1, (args) => {
    const v = list(args[0], 'BUTFIRSTS')
    return new LogoList(v.items.map((item) => {
      if (isList(item)) return new LogoList(item.items.slice(1))
      if (isWord(item)) return item.slice(1)
      return item
    }))
  })

  reg('BUTLASTS', 1, 1, (args) => {
    const v = list(args[0], 'BUTLASTS')
    return new LogoList(v.items.map((item) => {
      if (isList(item)) return new LogoList(item.items.slice(0, -1))
      if (isWord(item)) return item.slice(0, -1)
      return item
    }))
  })

  reg('ITEM', 2, 2, (args) => {
    const idx = args[0]
    if (!isNumber(idx)) throw badInput('ITEM', idx)
    const items = isWord(args[1]) ? args[1].split('') : seq(args[1], 'ITEM')
    const i = Math.trunc(idx)
    if (i < 1 || i > items.length) throw badInput('ITEM', idx)
    return items[i - 1]
  })

  reg('FPUT', 2, 2, (args) => {
    const v = args[1]
    if (isList(v)) return new LogoList([args[0], ...v.items])
    if (isWord(v)) return String(args[0]) + v
    throw badInput('FPUT', v)
  })

  reg('LPUT', 2, 2, (args) => {
    const v = args[1]
    if (isList(v)) return new LogoList([...v.items, args[0]])
    if (isWord(v)) return v + String(args[0])
    throw badInput('LPUT', v)
  })

  reg('SENTENCE', 0, 99, (args) => {
    const items: LogoValue[] = []
    for (const a of args) {
      if (isList(a)) items.push(...a.items)
      else items.push(a)
    }
    return new LogoList(items)
  })
  reg('SE', 0, 99, (args) => {
    const items: LogoValue[] = []
    for (const a of args) {
      if (isList(a)) items.push(...a.items)
      else items.push(a)
    }
    return new LogoList(items)
  })

  reg('LIST', 0, 99, (args) => new LogoList(args.slice()))

  reg('REVERSE', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return new LogoList(v.items.slice().reverse())
    if (isWord(v)) return v.split('').reverse().join('')
    throw badInput('REVERSE', v)
  })

  reg('COUNT', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return v.length
    if (isWord(v)) return v.length
    if (isArray(v)) return v.length
    if (typeof v === 'number') return String(v).length
    throw badInput('COUNT', v)
  })

  reg('MEMBERP', 2, 2, (args) => {
    const items = seq(args[1], 'MEMBERP')
    return items.some((item) => logoEqual(item, args[0]))
  })

  reg('MEMBER', 2, 2, (args) => {
    const items = seq(args[1], 'MEMBER')
    const idx = items.findIndex((item) => logoEqual(item, args[0]))
    if (idx === -1) return ''
    return new LogoList(items.slice(idx))
  })

  reg('REMDUP', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) {
      const out: LogoValue[] = []
      for (const item of v.items) {
        if (!out.some((o) => logoEqual(o, item))) out.push(item)
      }
      return new LogoList(out)
    }
    if (isWord(v)) {
      let out = ''
      for (const ch of v) {
        if (!out.includes(ch)) out += ch
      }
      return out
    }
    throw badInput('REMDUP', v)
  })

  reg('PICK', 1, 1, (args) => {
    const items = seq(args[0], 'PICK')
    if (items.length === 0) throw badInput('PICK', args[0])
    return items[Math.floor(Math.random() * items.length)]
  })

  reg('EMPTYP', 1, 1, (args) => {
    const v = args[0]
    if (isList(v)) return v.isEmpty()
    if (isWord(v)) return v === ''
    if (isArray(v)) return v.length === 0
    return v === null
  })

  reg('LISTP', 1, 1, (args) => isList(args[0]))
  reg('WORDP', 1, 1, (args) => isWord(args[0]))
  reg('NUMBERP', 1, 1, (args) => isNumber(args[0]))
  reg('ARRAYP', 1, 1, (args) => isArray(args[0]))

  reg('COMBINE', 2, 2, (args) => {
    const v = args[1]
    if (isList(v)) return new LogoList([args[0], ...v.items])
    if (isWord(v)) return String(args[0]) + v
    throw badInput('COMBINE', v)
  })
}
