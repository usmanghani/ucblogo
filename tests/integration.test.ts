import { describe, it, expect } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

function makeCtx() {
  const canvasCtx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '', font: '',
    fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    stroke: () => {}, arc: () => {}, fill: () => {}, translate: () => {},
    rotate: () => {}, closePath: () => {}, save: () => {}, restore: () => {}, fillText: () => {},
  } as unknown as CanvasRenderingContext2D
  const canvas = { width: 200, height: 200, getContext: () => canvasCtx } as unknown as HTMLCanvasElement
  const turtle = new Turtle(canvas)
  const output: string[] = []
  const interp = new Interpreter({ turtle, onOutput: (s) => output.push(s) })
  return { interp, turtle, output }
}

describe('integration', () => {
  it('draws a square', () => {
    const { interp, turtle } = makeCtx()
    interp.run('REPEAT 4 [FD 100 RT 90]')
    const s = turtle.getState()
    expect(s.heading).toBe(0)
    expect(s.x).toBeCloseTo(0)
    expect(s.y).toBeCloseTo(0)
  })

  it('draws a spiral', () => {
    const { interp, turtle } = makeCtx()
    interp.run('REPEAT 36 [FD 10 RT 10]')
    const s = turtle.getState()
    // After a full 360-degree rotation the turtle faces up again.
    expect(s.heading).toBeCloseTo(0)
  })

  it('runs a recursive tree without stack overflow', () => {
    const { interp } = makeCtx()
    interp.run(`
      TO TREE :SIZE
        IF :SIZE < 5 [STOP]
        FD :SIZE
        RT 30
        TREE :SIZE / 2
        LT 60
        TREE :SIZE / 2
        RT 30
        BK :SIZE
      END
      TREE 100
    `)
    expect(true).toBe(true)
  })

  it('computes factorial via recursion', () => {
    const { interp, output } = makeCtx()
    interp.run(`
      TO FACT :N
        IF :N = 0 [OUTPUT 1]
        OUTPUT :N * FACT :N - 1
      END
      PRINT FACT 6
    `)
    expect(output.join('')).toBe('720\n')
  })

  it('runs a nested list program', () => {
    const { interp, output } = makeCtx()
    interp.run('PRINT SENTENCE [HELLO] [WORLD]')
    expect(output.join('')).toBe('HELLO WORLD\n')
  })
})
