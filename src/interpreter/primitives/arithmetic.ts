/**
 * Arithmetic primitives.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { isNumber, isWord, isList, isArray, logoEqual } from '../types'
import { LogoError, badInput } from '../errors'

function num(v: LogoValue, name: string): number {
  if (isNumber(v)) return v
  throw badInput(name, v)
}

function int(v: LogoValue, name: string): number {
  if (isNumber(v) && Number.isInteger(v)) return v
  throw badInput(name, v)
}

function word(v: LogoValue, name: string): string {
  if (isWord(v)) return v
  throw badInput(name, v)
}

/** Register all arithmetic primitives. */
export function registerArithmetic(ev: Evaluator, _ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  // Binary arithmetic (variable arity when parenthesized).
  const binary = (name: string, op: (a: number, b: number) => number) => {
    reg(name, 2, 99, (args) => {
      let acc = num(args[0], name)
      for (let i = 1; i < args.length; i++) acc = op(acc, num(args[i], name))
      return acc
    })
  }
  binary('SUM', (a, b) => a + b)
  binary('DIFFERENCE', (a, b) => a - b)
  binary('PRODUCT', (a, b) => a * b)

  reg('QUOTIENT', 2, 99, (args) => {
    let acc = num(args[0], 'QUOTIENT')
    for (let i = 1; i < args.length; i++) {
      const d = num(args[i], 'QUOTIENT')
      if (d === 0) throw new LogoError('Division by zero', 'DIV_ZERO')
      acc /= d
    }
    return acc
  })

  reg('REMAINDER', 2, 2, (args) => int(args[0], 'REMAINDER') % int(args[1], 'REMAINDER'))
  reg('MODULO', 2, 2, (args) => {
    const a = int(args[0], 'MODULO')
    const b = int(args[1], 'MODULO')
    return ((a % b) + b) % b
  })
  reg('POWER', 2, 2, (args) => Math.pow(num(args[0], 'POWER'), num(args[1], 'POWER')))
  reg('SQRT', 1, 1, (args) => Math.sqrt(num(args[0], 'SQRT')))
  reg('SIN', 1, 1, (args) => Math.sin((num(args[0], 'SIN') * Math.PI) / 180))
  reg('COS', 1, 1, (args) => Math.cos((num(args[0], 'COS') * Math.PI) / 180))
  reg('ARCTAN', 1, 2, (args) => {
    if (args.length === 1) return (Math.atan(num(args[0], 'ARCTAN')) * 180) / Math.PI
    return (Math.atan2(num(args[0], 'ARCTAN'), num(args[1], 'ARCTAN')) * 180) / Math.PI
  })
  reg('RADSIN', 1, 1, (args) => Math.sin(num(args[0], 'RADSIN')))
  reg('RADCOS', 1, 1, (args) => Math.cos(num(args[0], 'RADCOS')))
  reg('RADARCTAN', 1, 2, (args) => {
    if (args.length === 1) return Math.atan(num(args[0], 'RADARCTAN'))
    return Math.atan2(num(args[0], 'RADARCTAN'), num(args[1], 'RADARCTAN'))
  })
  reg('INT', 1, 1, (args) => Math.trunc(num(args[0], 'INT')))
  reg('ROUND', 1, 1, (args) => Math.round(num(args[0], 'ROUND')))
  reg('ABS', 1, 1, (args) => Math.abs(num(args[0], 'ABS')))
  reg('MINUS', 1, 1, (args) => -num(args[0], 'MINUS'))
  reg('EXP', 1, 1, (args) => Math.exp(num(args[0], 'EXP')))
  reg('LN', 1, 1, (args) => Math.log(num(args[0], 'LN')))
  reg('LOG10', 1, 1, (args) => Math.log10(num(args[0], 'LOG10')))

  // Random numbers.
  reg('RANDOM', 1, 1, (args) => Math.floor(Math.random() * int(args[0], 'RANDOM')))
  reg('RRANDOM', 1, 1, (args) => {
    const n = int(args[0], 'RRANDOM')
    return Math.floor(Math.random() * (2 * n + 1)) - n
  })
  reg('SEEDRANDOM', 1, 1, (args) => {
    // Deterministic PRNG seed (mulberry32).
    const seed = int(args[0], 'SEEDRANDOM')
    let s = seed >>> 0
    const rand = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    ;(globalThis as unknown as { __logoRandom?: () => number }).__logoRandom = rand
    return ''
  })

  // Comparison predicates.
  reg('LESSP', 2, 2, (args) => num(args[0], 'LESSP') < num(args[1], 'LESSP'))
  reg('GREATERP', 2, 2, (args) => num(args[0], 'GREATERP') > num(args[1], 'GREATERP'))
  reg('LESSEQUALP', 2, 2, (args) => num(args[0], 'LESSEQUALP') <= num(args[1], 'LESSEQUALP'))
  reg('GREATEREQUALP', 2, 2, (args) => num(args[0], 'GREATEREQUALP') >= num(args[1], 'GREATEREQUALP'))
  reg('EQUALP', 2, 2, (args) => logoEqual(args[0], args[1]))
  reg('NOTEQUALP', 2, 2, (args) => !logoEqual(args[0], args[1]))
  reg('BEFOREP', 2, 2, (args) => word(args[0], 'BEFOREP') < word(args[1], 'BEFOREP'))

  // Boolean logic.
  reg('AND', 2, 99, (args) => args.every((a) => truthy(a)))
  reg('OR', 2, 99, (args) => args.some((a) => truthy(a)))
  reg('NOT', 1, 1, (args) => !truthy(args[0]))

  // Bitwise.
  reg('BITAND', 2, 99, (args) => args.reduce((acc: number, a: LogoValue) => acc & int(a, 'BITAND'), int(args[0], 'BITAND')))
  reg('BITOR', 2, 99, (args) => args.reduce((acc: number, a: LogoValue) => acc | int(a, 'BITOR'), int(args[0], 'BITOR')))
  reg('BITXOR', 2, 99, (args) => args.reduce((acc: number, a: LogoValue) => acc ^ int(a, 'BITXOR'), int(args[0], 'BITXOR')))
  reg('BITNOT', 1, 1, (args) => ~int(args[0], 'BITNOT'))
  reg('ASHIFT', 2, 2, (args) => {
    const n = int(args[0], 'ASHIFT')
    const shift = int(args[1], 'ASHIFT')
    return shift >= 0 ? n << shift : n >> -shift
  })
  reg('LSHIFT', 2, 2, (args) => int(args[0], 'LSHIFT') << int(args[1], 'LSHIFT'))
  reg('RSHIFT', 2, 2, (args) => int(args[0], 'RSHIFT') >> int(args[1], 'RSHIFT'))
}

function truthy(v: LogoValue): boolean {
  if (isWord(v)) return v !== '' && v !== 'FALSE' && v !== 'false'
  if (isNumber(v)) return v !== 0
  if (isList(v)) return !v.isEmpty()
  if (isArray(v)) return v.length > 0
  return v !== null
}
