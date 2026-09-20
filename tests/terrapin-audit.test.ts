import { expect, it } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { Interpreter } from '../src/interpreter/interpreter'
import { Environment } from '../src/interpreter/environment'
import { parse } from '../src/interpreter/parser'
import { tokenize } from '../src/interpreter/lexer'
import { Turtle } from '../src/turtle/Turtle'

it('audits every procedure body and bounded startup without claiming behavioral parity', () => {
  const directory = 'tests/fixtures/terrapin-logolib'
  const report = readdirSync(directory).filter(file => file.endsWith('.lgo')).sort().map(file => {
    Environment.clearProcs()
    const errors: string[] = []
    const interpreter = new Interpreter({ turtle: new Turtle(document.createElement('canvas')), onError: error => errors.push(error.message) })
    const source = readFileSync(`${directory}/${file}`, 'utf8')
    const definitions = parse(tokenize(source), interpreter.evaluator).filter(node => node.type === 'procdef')
    for (const definition of definitions) interpreter.evaluator.eval(definition, interpreter.env)
    const bodyFailures: string[] = []
    for (const definition of definitions) {
      try { interpreter.evaluator.parseProcBody(Environment.getProc(definition.name)!) }
      catch (error) { bodyFailures.push(`${definition.name}: ${(error as Error).message}`) }
    }
    interpreter.run(source)
    return { file, procedures: definitions.length, bodyFailures, startupErrors: errors, behavior: 'not-verified' }
  })
  expect(report).toHaveLength(47)
  if (process.env.UPDATE_TERRAPIN_AUDIT === '1') {
    writeFileSync('tests/fixtures/terrapin-audit.json', `${JSON.stringify(report, null, 2)}\n`)
  }
  expect(report).toEqual(JSON.parse(readFileSync('tests/fixtures/terrapin-audit.json', 'utf8')))
})
