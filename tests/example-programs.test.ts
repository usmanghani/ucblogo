import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

afterEach(() => vi.useRealTimers())

for (const file of readdirSync('examples').filter(name => name.endsWith('.lgo'))) {
  describe(file, () => {
    for (const runs of [1, 2]) {
      it(`executes the complete drawing ${runs} time(s) without errors`, async () => {
        vi.useFakeTimers()
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 420
        const turtle = new Turtle(canvas)
        const output: string[] = []
        const interpreter = new Interpreter({ turtle, onOutput: text => output.push(text) })
        const source = readFileSync(`examples/${file}`, 'utf8')
        for (let i = 0; i < runs; i++) {
          const execution = interpreter.runAsync(source, new AbortController().signal)
          await vi.runAllTimersAsync()
          await execution
        }
        expect(output).toEqual([])
        expect(turtle.getState().visible).toBe(false)
        expect(turtle.getState().x).toBe(0)
        expect(turtle.getState().y).toBe(0)
      })
    }
  })
}
