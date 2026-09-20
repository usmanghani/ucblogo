import { describe, it, expect, vi } from 'vitest'
import { Turtle } from '../src/turtle/Turtle'

/** Create a Turtle with a mock canvas context. */
function makeTurtle() {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    font: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  const canvas = { width: 200, height: 200, getContext: () => ctx } as unknown as HTMLCanvasElement
  return new Turtle(canvas)
}

describe('Turtle', () => {
  it('starts at center facing up', () => {
    const t = makeTurtle()
    const s = t.getState()
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
    expect(s.heading).toBe(0)
    expect(s.penDown).toBe(true)
  })

  it('moves forward', () => {
    const t = makeTurtle()
    t.forward(100)
    expect(t.getState().y).toBe(100)
    expect(t.getState().x).toBe(0)
  })

  it('turns right and left', () => {
    const t = makeTurtle()
    t.right(90)
    expect(t.getState().heading).toBe(90)
    t.left(45)
    expect(t.getState().heading).toBe(45)
  })

  it('moves in heading direction', () => {
    const t = makeTurtle()
    t.setHeading(90)
    t.forward(100)
    expect(t.getState().x).toBeCloseTo(100)
    expect(t.getState().y).toBeCloseTo(0)
  })

  it('toggles pen state', () => {
    const t = makeTurtle()
    t.penUp()
    expect(t.getState().penDown).toBe(false)
    t.penDown()
    expect(t.getState().penDown).toBe(true)
  })

  it('sets pen color', () => {
    const t = makeTurtle()
    t.setPenColor(4)
    expect(t.getState().penColor).toBe(4)
  })

  it('homes back to center', () => {
    const t = makeTurtle()
    t.forward(50)
    t.right(30)
    t.home()
    const s = t.getState()
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
    expect(s.heading).toBe(0)
  })
})

// After a worker run, manual REPL commands must continue with its pen settings.
it('adopts isolated drawing state and pen style before further movement', () => {
  const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  const turtle = makeTurtle()
  const strokes = contexts.mock.results[0].value as CanvasRenderingContext2D
  const state = { ...turtle.getState(), penColor: 4, penSize: 3, x: 30, y: 40, visible: false }
  const image = {} as ImageBitmap
  turtle.applySnapshot(image, state)
  turtle.forward(10)
  expect(strokes.drawImage).toHaveBeenCalledWith(image, 0, 0)
  expect(strokes.strokeStyle).toBe('#aa0000')
  expect(strokes.lineWidth).toBe(3)
  expect(turtle.getState()).toMatchObject({ x: 30, y: 50, penColor: 4, penSize: 3 })
  contexts.mockRestore()
})
