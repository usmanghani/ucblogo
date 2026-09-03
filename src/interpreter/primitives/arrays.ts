/**
 * Array primitives.
 */

import type { Evaluator } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoArray, LogoList, isArray, isNumber, isList } from '../types'
import { badInput } from '../errors'

/** Register all array primitives. */
export function registerArrays(ev: Evaluator): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  reg('ARRAY', 1, 2, (args) => {
    const size = args[0]
    if (!isNumber(size) || !Number.isInteger(size) || size < 0) throw badInput('ARRAY', size)
    let origin = 1
    if (args.length === 2) {
      if (!isNumber(args[1])) throw badInput('ARRAY', args[1])
      origin = Math.trunc(args[1])
    }
    return new LogoArray(Math.trunc(size), origin)
  })

  reg('ARRAYTOLIST', 1, 1, (args) => {
    if (!isArray(args[0])) throw badInput('ARRAYTOLIST', args[0])
    return args[0].toList()
  })

  reg('LISTTOARRAY', 1, 2, (args) => {
    if (!isList(args[0])) throw badInput('LISTTOARRAY', args[0])
    let origin = 1
    if (args.length === 2) {
      if (!isNumber(args[1])) throw badInput('LISTTOARRAY', args[1])
      origin = Math.trunc(args[1])
    }
    const arr = new LogoArray(args[0].items.length, origin)
    for (let i = 0; i < args[0].items.length; i++) {
      arr.items[i] = args[0].items[i]
    }
    return arr
  })

  reg('SETITEM', 3, 3, (args) => {
    if (!isArray(args[0])) throw badInput('SETITEM', args[0])
    if (!isNumber(args[1])) throw badInput('SETITEM', args[1])
    args[0].set(Math.trunc(args[1]), args[2])
    return args[0]
  })

  reg('ITEM', 2, 2, (args) => {
    if (!isNumber(args[0])) throw badInput('ITEM', args[0])
    const idx = Math.trunc(args[0])
    if (isArray(args[1])) {
      return args[1].get(idx)
    }
    if (isList(args[1])) {
      if (idx < 1 || idx > args[1].items.length) throw badInput('ITEM', args[0])
      return args[1].items[idx - 1]
    }
    if (typeof args[1] === 'string' || typeof args[1] === 'number') {
      const chars = String(args[1])
      if (idx < 1 || idx > chars.length) throw badInput('ITEM', args[0])
      return chars[idx - 1]
    }
    throw badInput('ITEM', args[1])
  })

  reg('ARRAYDIMS', 1, 1, (args) => {
    if (!isArray(args[0])) throw badInput('ARRAYDIMS', args[0])
    return new LogoList([args[0].length, args[0].origin])
  })

  reg('ARRAYP', 1, 1, (args) => isArray(args[0]))
}
