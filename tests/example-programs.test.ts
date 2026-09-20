import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

for (const file of readdirSync('examples').filter(name => name.endsWith('.lgo'))) {
  describe(file, () => {
    for (const runs of [1, 2]) {
      it(`executes the complete drawing ${runs} time(s) without errors`, () => {
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 420
        const turtle = new Turtle(canvas)
        const output: string[] = []
        const interpreter = new Interpreter({ turtle, onOutput: text => output.push(text) })
        const source = readFileSync(`examples/${file}`, 'utf8')
        for (let i = 0; i < runs; i++) interpreter.run(source)
        expect(output).toEqual([])
        expect(turtle.getState().visible).toBe(false)
        expect(turtle.getState().x).toBe(0)
        expect(turtle.getState().y).toBe(0)
      })
    }
  })
}
