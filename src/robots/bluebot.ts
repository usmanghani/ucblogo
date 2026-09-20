import { tokenize } from '../interpreter/lexer'
import { parse, type ASTNode } from '../interpreter/parser'
import { LogoError } from '../interpreter/errors'

/** Logical robot instructions, deliberately distinct from unverified BLE bytes. */
export type BlueBotInstruction =
  | { command: 'forward' | 'back' | 'left45' | 'right45' | 'left90' | 'right90' | 'pause' }
  | { command: 'repeat'; count: number; body: BlueBotInstruction[] }

export function compileBlueBot(source: string): BlueBotInstruction[] {
  let slots = 0
  function fail(message: string, node: ASTNode): never {
    throw new LogoError(message, 'BAD_INPUT', undefined, node.type === 'call' ? node : undefined)
  }
  function compile(nodes: ASTNode[], nested = false): BlueBotInstruction[] {
    const result: BlueBotInstruction[] = []
    for (const node of nodes) {
      if (node.type !== 'call') fail('Blue-Bot requires movement instructions', node)
      const input = node.args[0]
      if (input?.type !== 'literal' || typeof input.value !== 'number' || !Number.isFinite(input.value)) fail('Blue-Bot inputs must be finite numeric constants', node)
      const amount = input.value
      if (node.name === 'REPEAT') {
        if (nested || !Number.isInteger(amount) || amount < 1 || amount > 16) fail('Blue-Bot REPEAT must be unnested and between 1 and 16', node)
        const body = node.args[1]
        if (body?.type !== 'list') fail('Blue-Bot REPEAT needs an instruction list', node)
        slots += 2
        result.push({ command: 'repeat', count: amount, body: compile(body.items, true) })
      } else {
        let count: number
        let command: Exclude<BlueBotInstruction['command'], 'repeat'>
        switch (node.name) {
          case 'FD': case 'FORWARD': case 'BK': case 'BACK':
            if (!Number.isInteger(amount)) fail('Blue-Bot distance must use whole movement units', node)
            count = Math.abs(amount)
            command = (node.name === 'FD' || node.name === 'FORWARD') === (amount >= 0) ? 'forward' : 'back'
            break
          case 'LT': case 'LEFT': case 'RT': case 'RIGHT': {
            if (amount % 45 !== 0) fail('Blue-Bot turns must be multiples of 45 degrees', node)
            const left = (node.name === 'LT' || node.name === 'LEFT') === (amount >= 0)
            count = Math.floor(Math.abs(amount) / 90)
            command = left ? 'left90' : 'right90'
            if (Math.abs(amount) % 90) { result.push({ command: left ? 'left45' : 'right45' }); slots++ }
            break
          }
          case 'WAIT':
            if (amount < 0) fail('Blue-Bot WAIT must be nonnegative', node)
            count = Math.ceil(amount / 2000); command = 'pause'; break
          default: fail(`Blue-Bot does not support ${node.name}`, node)
        }
        slots += count
        if (slots > 200) fail('Blue-Bot program exceeds 200 instruction slots', node)
        for (let i = 0; i < count; i++) result.push({ command })
      }
      if (slots > 200) fail('Blue-Bot program exceeds 200 instruction slots', node)
    }
    return result
  }
  return compile(parse(tokenize(source)))
}
