import { describe, it, expect } from 'vitest'
import { PRIMITIVE_ARITY } from '../src/interpreter/arity'
import { Interpreter } from '../src/interpreter/interpreter'

describe('primitive registry parity', () => {
  it('declares every arity key in uppercase', () => {
    const lowercase = Object.keys(PRIMITIVE_ARITY).filter((k) => k !== k.toUpperCase())
    expect(lowercase).toEqual([])
  })

  it('registers every declared primitive', () => {
    const interp = new Interpreter()
    const missing = Object.keys(PRIMITIVE_ARITY).filter((name) => !interp.evaluator.hasPrimitive(name.toUpperCase()))
    expect(missing).toEqual([])
  })

  it('has no duplicate arity keys', () => {
    const keys = Object.keys(PRIMITIVE_ARITY)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
