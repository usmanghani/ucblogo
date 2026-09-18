import { expect, it } from 'vitest'
import * as Blockly from 'blockly'
import { generateLogo } from '../src/blocks/logo'
import { Interpreter } from '../src/interpreter/interpreter'

it('generates executable loops and preserves blocks across serialization', () => {
  const ws = new Blockly.Workspace()
  try {
    const loop = ws.newBlock('logo_repeat')
    const count = ws.newBlock('logo_number')
    count.setFieldValue(3, 'VALUE')
    loop.getInput('COUNT')!.connection!.connect(count.outputConnection!)
    const command = ws.newBlock('logo_command')
    command.setFieldValue('PRINT', 'COMMAND')
    const number = ws.newBlock('logo_number')
    number.setFieldValue(7, 'VALUE')
    command.getInput('VALUE')!.connection!.connect(number.outputConnection!)
    loop.getInput('BODY')!.connection!.connect(command.previousConnection!)
    const source = generateLogo(ws)
    const output: string[] = []
    const errors: Error[] = []
    new Interpreter({ onOutput: text => output.push(text), onError: error => errors.push(error) }).run(source)
    expect(errors).toEqual([])
    expect(output.join('')).toBe('7\n7\n7\n')
    const state = Blockly.serialization.workspaces.save(ws)
    ws.clear()
    Blockly.serialization.workspaces.load(state, ws)
    expect(generateLogo(ws)).toBe(source)
  } finally { ws.dispose() }
})

it('rejects incomplete inputs', () => {
  const ws = new Blockly.Workspace()
  try {
    ws.newBlock('logo_command')
    expect(() => generateLogo(ws)).toThrow('Connect a value')
  } finally { ws.dispose() }
})
