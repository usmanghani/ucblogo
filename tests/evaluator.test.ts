import { describe, it, expect, beforeEach } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'

function makeInterp() {
  const output: string[] = []
  const interp = new Interpreter({ onOutput: (s) => output.push(s) })
  return { interp, output }
}

interface TestCtx {
  interp: Interpreter
  output: string[]
}

describe('evaluator', () => {
  let ctx: TestCtx

  beforeEach(() => {
    ctx = makeInterp()
  })

  it('evaluates arithmetic', () => {
    expect(ctx.interp.run('PRINT SUM 2 3')).toBe('')
    expect(ctx.output.join('')).toBe('5\n')
  })

  it('evaluates infix with precedence', () => {
    ctx.interp.run('PRINT 2 + 3 * 4')
    expect(ctx.output.join('')).toBe('14\n')
  })

  it('evaluates list operations', () => {
    ctx.interp.run('PRINT FIRST [A B C]')
    expect(ctx.output.join('')).toBe('A\n')
  })

  it('evaluates words', () => {
    ctx.interp.run('PRINT WORD "HEL "LO')
    expect(ctx.output.join('')).toBe('HELLO\n')
  })

  it('handles REPEAT and REPCOUNT', () => {
    ctx.interp.run('REPEAT 3 [PRINT REPCOUNT]')
    expect(ctx.output.join('')).toBe('1\n2\n3\n')
  })

  it('handles IF/IFELSE', () => {
    ctx.interp.run('IF 5 > 3 [PRINT [YES]]')
    ctx.interp.run('IFELSE 1 > 2 [PRINT [A]] [PRINT [B]]')
    expect(ctx.output.join('')).toBe('YES\nB\n')
  })

  it('handles WHILE', () => {
    ctx.interp.run('MAKE "X 0 WHILE :X < 3 [PRINT :X MAKE "X :X + 1]')
    expect(ctx.output.join('')).toBe('0\n1\n2\n')
  })

  it('handles FOR loops', () => {
    ctx.interp.run('FOR [I 1 3] [PRINT :I]')
    expect(ctx.output.join('')).toBe('1\n2\n3\n')
  })

  it('defines and calls procedures', () => {
    ctx.interp.run('TO SQUARE :N REPEAT 4 [PRINT :N] END')
    ctx.interp.run('SQUARE 7')
    expect(ctx.output.join('')).toBe('7\n7\n7\n7\n')
  })

  it('supports OUTPUT', () => {
    ctx.interp.run('TO DOUBLE :X OUTPUT :X * 2 END')
    ctx.interp.run('PRINT DOUBLE 21')
    expect(ctx.output.join('')).toBe('42\n')
  })

  it('supports deep recursion without stack overflow', () => {
    ctx.interp.run('TO COUNT :N IF :N > 0 [COUNT :N - 1] END')
    ctx.interp.run('COUNT 5000')
    // Should complete without throwing.
    expect(true).toBe(true)
  })

  it('supports dynamic scoping', () => {
    ctx.interp.run('TO OUTER MAKE "V 10 INNER END')
    ctx.interp.run('TO INNER PRINT :V END')
    ctx.interp.run('OUTER')
    expect(ctx.output.join('')).toBe('10\n')
  })

  it('handles MAP', () => {
    ctx.interp.run('PRINT MAP "ABS [-3 4 -5]')
    expect(ctx.output.join('')).toBe('3 4 5\n')
  })

  it('handles property lists', () => {
    ctx.interp.run('PPROP "P "NAME "ADA')
    ctx.interp.run('PRINT GPROP "P "NAME')
    expect(ctx.output.join('')).toBe('ADA\n')
  })

  it('reports unknown procedures', () => {
    expect(() => ctx.interp.run('FOOBAR')).not.toThrow()
  })
})
