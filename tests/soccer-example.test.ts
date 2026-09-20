import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

it('draws the soccer ball and redraws it without diagnostics', () => {
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 300
  const turtle = new Turtle(canvas)
  const arc = vi.spyOn(turtle, 'arc')
  const line = vi.spyOn(turtle, 'setXY')
  const output: string[] = []
  const interpreter = new Interpreter({ turtle, onOutput: text => output.push(text) })
  interpreter.run(readFileSync('examples/soccer.lgo', 'utf8'))
  expect(output).toEqual([])
  expect(arc).toHaveBeenCalledWith(360, 120)
  expect(line).toHaveBeenCalledWith(46, 15)
  expect(line).toHaveBeenCalledWith(-28, -39)
  interpreter.run('SOCCER')
  expect(output).toEqual([])
  expect(arc).toHaveBeenCalledTimes(2)
  expect(turtle.getState()).toMatchObject({ x: 0, y: 0, visible: false })
})
