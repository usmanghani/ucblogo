import { describe, expect, it } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { LogoError } from '../src/interpreter/errors'

describe('interpreter diagnostics', () => {
  it.each(['PLAY [C D E]', 'TELL 1', 'STAMPRECT 10 20', 'WAIT 60'])(
    'reports unsupported capabilities instead of silently succeeding: %s', (source) => {
      let received: Error | undefined
      const interpreter = new Interpreter({ onError: (error) => { received = error } })
      interpreter.run(source)
      expect(received?.message).toContain('is not implemented yet')
      expect((received as LogoError).location).toEqual({ line: 1, col: 1 })
    },
  )
  it('reports syntax errors with a source location', () => {
    let received: Error | undefined
    const interpreter = new Interpreter({ onError: (error) => { received = error } })
    interpreter.run('REPEAT 2 [FD 10')
    expect(received).toBeInstanceOf(LogoError)
    expect((received as LogoError).location).toMatchObject({ line: 1 })
  })

  it('reports runtime errors at the failing call', () => {
    let received: Error | undefined
    const interpreter = new Interpreter({ onError: (error) => { received = error } })
    interpreter.run('FD "not-a-number')
    expect(received).toBeInstanceOf(LogoError)
    expect((received as LogoError).location).toMatchObject({ line: 1, col: 1 })
  })
})
