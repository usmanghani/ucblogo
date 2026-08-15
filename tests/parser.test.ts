import { describe, it, expect } from 'vitest'
import { tokenize } from '../src/interpreter/lexer'
import { parse } from '../src/interpreter/parser'

describe('parser', () => {
  it('parses a simple procedure call', () => {
    const ast = parse(tokenize('PRINT 5'))
    expect(ast).toHaveLength(1)
    expect(ast[0]).toMatchObject({ type: 'call', name: 'PRINT' })
  })

  it('parses a quoted word literal', () => {
    const ast = parse(tokenize('PRINT "hello'))
    expect(ast[0]).toMatchObject({ type: 'call', name: 'PRINT' })
    const call = ast[0] as { args: unknown[] }
    expect(call.args[0]).toMatchObject({ type: 'literal', value: 'hello' })
  })

  it('parses a variable reference', () => {
    const ast = parse(tokenize('PRINT :x'))
    const call = ast[0] as { args: unknown[] }
    expect(call.args[0]).toMatchObject({ type: 'varref', name: 'x' })
  })

  it('parses a list literal', () => {
    const ast = parse(tokenize('PRINT [A B C]'))
    const call = ast[0] as { args: unknown[] }
    expect(call.args[0]).toMatchObject({ type: 'list' })
  })

  it('parses infix with precedence', () => {
    const ast = parse(tokenize('PRINT 2 + 3 * 4'))
    const call = ast[0] as { args: unknown[] }
    const infix = call.args[0] as { type: string; op: string }
    expect(infix.type).toBe('infix')
    expect(infix.op).toBe('+')
  })

  it('parses a procedure definition', () => {
    const ast = parse(tokenize('TO SQUARE :N REPEAT 4 [FD :N RT 90] END'))
    expect(ast[0]).toMatchObject({ type: 'procdef', name: 'SQUARE', params: ['N'] })
  })

  it('parses multiple statements', () => {
    const ast = parse(tokenize('FD 10 RT 90'))
    expect(ast).toHaveLength(2)
    expect(ast[0]).toMatchObject({ type: 'call', name: 'FD' })
    expect(ast[1]).toMatchObject({ type: 'call', name: 'RT' })
  })
})
