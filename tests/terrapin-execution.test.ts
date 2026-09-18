import { beforeEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Interpreter } from '../src/interpreter/interpreter'

let interpreter: Interpreter
let errors: Error[]
beforeEach(() => {
  errors = []
  interpreter = new Interpreter({ onError: error => errors.push(error) })
  interpreter.reset()
  interpreter.run(readFileSync('tests/fixtures/terrapin-logolib/factorial.lgo', 'utf8'))
})

it.each(['FACTORING', 'FACTORIAL.FOR', 'FACTORIAL.WHILE', 'FACTORIAL.RECUR'])(
  'executes the original library procedure %s', name => {
    expect(interpreter.run(`${name} 5`)).toBe('120')
    expect(interpreter.run(`${name} 0`)).toBe('1')
    expect(errors).toEqual([])
    expect(interpreter.env.has('ANSWER')).toBe(false)
  },
)

it('preserves all arguments in an extended parenthesized call', () => {
  expect(interpreter.run('(SUM 1 2 3 4)')).toBe('10')
  expect(errors).toEqual([])
})
