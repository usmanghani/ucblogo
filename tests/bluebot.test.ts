import { expect, it } from 'vitest'
import { compileBlueBot } from '../src/robots/bluebot'

it('compiles a square using native repeat and quarter turns', () => {
  expect(compileBlueBot('REPEAT 4 [FD 1 RT 90]')).toEqual([
    { command: 'repeat', count: 4, body: [{ command: 'forward' }, { command: 'right90' }] },
  ])
})
it('reverses negative movement and rounds robot pauses upward', () => {
  expect(compileBlueBot('FD -1 WAIT 2100')).toEqual([{ command: 'back' }, { command: 'pause' }, { command: 'pause' }])
})
it.each(['FD 201', 'RT 12', 'REPEAT 17 [FD 1]', 'REPEAT 2 [REPEAT 2 [FD 1]]', 'WAIT -1'])(
  'rejects invalid robot program %s', source => expect(() => compileBlueBot(source)).toThrow(),
)
