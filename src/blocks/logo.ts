import * as Blockly from 'blockly'

const commands = ['FORWARD', 'BACK', 'RIGHT', 'LEFT', 'SETPENCOLOR', 'SETPENSIZE', 'PRINT']
export const toolbox = {
  kind: 'flyoutToolbox',
  contents: ['logo_command', 'logo_action', 'logo_repeat', 'logo_make', 'logo_number', 'logo_variable'].map(type => ({ kind: 'block', type })),
}

Blockly.common.defineBlocksWithJsonArray([
  { type: 'logo_command', message0: '%1 %2', args0: [{ type: 'field_dropdown', name: 'COMMAND', options: commands.map(name => [name.toLowerCase(), name]) }, { type: 'input_value', name: 'VALUE' }], previousStatement: null, nextStatement: null, colour: 210 },
  { type: 'logo_action', message0: '%1', args0: [{ type: 'field_dropdown', name: 'COMMAND', options: ['HOME', 'CS', 'PU', 'PD', 'HT', 'ST'].map(name => [name, name]) }], previousStatement: null, nextStatement: null, colour: 210 },
  { type: 'logo_repeat', message0: 'repeat %1 times %2', args0: [{ type: 'input_value', name: 'COUNT' }, { type: 'input_statement', name: 'BODY' }], previousStatement: null, nextStatement: null, colour: 120 },
  { type: 'logo_make', message0: 'set %1 to %2', args0: [{ type: 'field_input', name: 'NAME', text: 'distance' }, { type: 'input_value', name: 'VALUE' }], previousStatement: null, nextStatement: null, colour: 330 },
  { type: 'logo_number', message0: '%1', args0: [{ type: 'field_number', name: 'VALUE', value: 50 }], output: null, colour: 260 },
  { type: 'logo_variable', message0: 'value of %1', args0: [{ type: 'field_input', name: 'NAME', text: 'distance' }], output: null, colour: 330 },
])

export const logoGenerator = new Blockly.Generator('Logo')
function name(block: Blockly.Block): string {
  const value = String(block.getFieldValue('NAME'))
  if (!/^[A-Za-z_][A-Za-z_0-9.]*$/.test(value)) throw new Error('Variable names must start with a letter and contain letters, digits, underscores or dots')
  return value
}
logoGenerator.scrub_ = (block, code, thisOnly) => code + (thisOnly ? '' : logoGenerator.blockToCode(block.getNextBlock()))
logoGenerator.forBlock.logo_number = block => [String(block.getFieldValue('VALUE')), 0]
logoGenerator.forBlock.logo_variable = block => [`:${name(block)}`, 0]
const value = (block: Blockly.Block, input: string) => {
  const code = logoGenerator.valueToCode(block, input, 0)
  if (!code) throw new Error(`Connect a value to ${input.toLowerCase()}`)
  return code
}
logoGenerator.forBlock.logo_command = block => `${block.getFieldValue('COMMAND')} ${value(block, 'VALUE')}\n`
logoGenerator.forBlock.logo_action = block => `${block.getFieldValue('COMMAND')}\n`
logoGenerator.forBlock.logo_make = block => `MAKE "${name(block)} ${value(block, 'VALUE')}\n`
logoGenerator.forBlock.logo_repeat = block => `REPEAT ${value(block, 'COUNT')} [\n${logoGenerator.statementToCode(block, 'BODY')}]\n`

export function generateLogo(workspace: Blockly.Workspace): string {
  return logoGenerator.workspaceToCode(workspace)
}
