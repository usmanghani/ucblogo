import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { tokenize } from '../src/interpreter/lexer'
import { parse } from '../src/interpreter/parser'
import { Interpreter } from '../src/interpreter/interpreter'

describe('Terrapin library inventory', () => {
  it('parses every downloaded Terrapin program', () => {
    const dir = resolve(process.cwd(), 'tests/fixtures/terrapin-logolib')
    const interp = new Interpreter()
    const files = readdirSync(dir).filter((f) => f.endsWith('.lgo')).sort()
    expect(files).toHaveLength(47)
    const failures: string[] = []
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8')
      try {
        parse(tokenize(source), interp.evaluator)
      } catch (error) {
        const e = error as Error & { logoNumber?: number; code?: string }
        failures.push(`${file}: ${e.message} [${e.code ?? ''} ${e.logoNumber ?? ''}]`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })
})
