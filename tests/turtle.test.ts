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
