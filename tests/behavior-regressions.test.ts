import { describe, it, expect } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

describe('language behavior regression cases', () => {
  it.each([
    ['PRINT 2 + 3 * 4', '14'],
    ['PRINT (2 + 3) * 4', '20'],
    ['PRINT DIFFERENCE 2 7', '-5'],
    ['PRINT QUOTIENT 21 3', '7'],
    ['PRINT REMAINDER 17 5', '2'],
    ['PRINT ABS -9', '9'],
    ['PRINT SQRT 81', '9'],
    ['PRINT POWER 2 8', '256'],
    ['PRINT FIRST [COW PIG HEN]', 'COW'],
    ['PRINT LAST [COW PIG HEN]', 'HEN'],
    ['PRINT BUTFIRST [COW PIG HEN]', 'PIG HEN'],
    ['PRINT BUTLAST [COW PIG HEN]', 'COW PIG'],
    ['PRINT COUNT [COW PIG HEN]', '3'],
    ['PRINT ITEM 2 [COW PIG HEN]', 'PIG'],
    ['PRINT WORD "FARM "HOUSE', 'FARMHOUSE'],
    ['PRINT SENTENCE [RED BARN] [GREEN FIELD]', 'RED BARN GREEN FIELD'],
    ['PRINT REVERSE [1 2 3]', '3 2 1'],
    ['MAKE "N 5 MAKE "N :N + 4 PRINT :N', '9'],
    ['IF 3 > 2 [PRINT [YES]]', 'YES'],
    ['IFELSE 3 < 2 [PRINT [BAD]] [PRINT [GOOD]]', 'GOOD'],
    ['REPEAT 0 [PRINT [BAD]] PRINT [DONE]', 'DONE'],
    ['REPEAT 3 [PRINT REPCOUNT]', '1\n2\n3'],
    ['REPEAT 2 [REPEAT 2 [PRINT [X]]]', 'X\nX\nX\nX'],
    ['TO TWICE :N OUTPUT :N * 2 END PRINT TWICE 9', '18'],
    ['TO EARLY PRINT "BEFORE STOP PRINT "BAD END EARLY', 'BEFORE'],
    ['TO FACT :N IF :N = 0 [OUTPUT 1] OUTPUT :N * FACT :N - 1 END PRINT FACT 6', '720'],
  ])('%s', (source, expected) => {
    const output: string[] = []
    new Interpreter({ onOutput: text => output.push(text) }).run(source)
    expect(output.join('').trim()).toBe(expected)
  })
})

describe('turtle movement invariants', () => {
  it.each([0, 30, 90, 180, 270, 359])('forward/back restores position at heading %s', heading => {
    const canvas = document.createElement('canvas')
    canvas.width = 600; canvas.height = 400
    const turtle = new Turtle(canvas)
    const output: string[] = []
    new Interpreter({ turtle, onOutput: text => output.push(text) })
      .run(`WINDOW SETH ${heading} FD 75 BK 75`)
    expect(output).toEqual([])
    expect(turtle.getState().x).toBeCloseTo(0)
    expect(turtle.getState().y).toBeCloseTo(0)
    expect(turtle.getState().heading).toBe(heading)
  })
  it.each([3, 4, 6, 8, 12])('a regular %s-sided polygon closes', sides => {
    const canvas = document.createElement('canvas')
    canvas.width = 600; canvas.height = 400
    const turtle = new Turtle(canvas)
    const output: string[] = []
    new Interpreter({ turtle, onOutput: text => output.push(text) })
      .run(`WINDOW REPEAT ${sides} [FD 20 RT ${360 / sides}]`)
    expect(output).toEqual([])
    expect(turtle.getState().x).toBeCloseTo(0)
    expect(turtle.getState().y).toBeCloseTo(0)
    expect(turtle.getState().heading % 360).toBeCloseTo(0)
  })
})
