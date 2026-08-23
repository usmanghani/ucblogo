import { describe, it, expect, vi, afterEach } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

/**
 * Regression tests pinning the turtle rendering pipeline:
 * strokes go to an offscreen buffer; render() composites the buffer onto
 * the display canvas and draws the marker on top. Guards against the
 * historical bug where the marker was never drawn / strokes bypassed the
 * buffer (which erased lines under the moving marker).
 */

interface LogEntry {
  tag: 'buf' | 'disp'
  op: string
  style: string
}

/** Context factory that records every op with the strokeStyle at call time. */
const makeCtx = (log: LogEntry[], tag: 'buf' | 'disp'): CanvasRenderingContext2D => {
  const state = { strokeStyle: '#000000', fillStyle: '' }
  const target: Record<string, unknown> = {
    get strokeStyle() { return state.strokeStyle },
    set strokeStyle(v: string) { state.strokeStyle = v },
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v },
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    font: '',
  }
  const ops = [
    'fillRect', 'clearRect', 'drawImage', 'beginPath', 'moveTo', 'lineTo',
    'stroke', 'arc', 'fill', 'translate', 'rotate', 'closePath',
    'save', 'restore', 'fillText',
  ]
  for (const op of ops) {
    target[op] = () => { log.push({ tag, op, style: state.strokeStyle }) }
  }
  return target as unknown as CanvasRenderingContext2D
}

const RAINBOW_SPIRAL = `TO rainbow_spiral :size :angle
  IF :size > 300 [STOP]
  SETPENCOLOR (SETBGCOLOR)
  FORWARD :size
  RIGHT :angle
  rainbow_spiral (:size + 2) :angle
END

CS
rainbow_spiral 1 89`

describe('turtle render pipeline regression', () => {
  const log: LogEntry[] = []
  const dispCtx = makeCtx(log, 'disp')
  const bufCtx = makeCtx(log, 'buf')
  const bufCanvas = { width: 2000, height: 1500, getContext: () => bufCtx } as unknown as HTMLCanvasElement

  // Route Turtle's offscreen buffer creation to our recorded buffer canvas.
  const realCreateElement = document.createElement.bind(document)
  beforeEach(() => {
    log.length = 0
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? bufCanvas : realCreateElement(tag)) as typeof document.createElement)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const makeTurtleAndInterpreter = () => {
    const canvas = { width: 2000, height: 1500, getContext: () => dispCtx } as unknown as HTMLCanvasElement
    const turtle = new Turtle(canvas)
    const output: string[] = []
    const interp = new Interpreter({ turtle, onOutput: (s) => output.push(s) })
    return { turtle, interp, output }
  }

  it('composites the stroke buffer onto the display canvas', () => {
    expect(bufCtx).not.toBe(dispCtx)

    const drawSpy = vi.spyOn(dispCtx, 'drawImage')
    const { interp } = makeTurtleAndInterpreter()
    interp.run('FD 60')

    expect(drawSpy).toHaveBeenCalledWith(bufCanvas, 0, 0)
    const draws = log.filter((e) => e.tag === 'disp' && e.op === 'drawImage')
    expect(draws.length).toBeGreaterThan(0)
  })

  it('lands CS + FD strokes on the buffer after the background fill', () => {
    const { interp } = makeTurtleAndInterpreter()

    interp.run('CS FD 60')

    const lastFillIdx = log.map((e) => e.op).lastIndexOf('fillRect')
    expect(lastFillIdx).toBeGreaterThanOrEqual(0)

    const bufStrokesAfterFill = log
      .slice(lastFillIdx + 1)
      .filter((e) => e.tag === 'buf' && (e.op === 'lineTo' || e.op === 'stroke'))
    expect(bufStrokesAfterFill.length).toBeGreaterThanOrEqual(1)

    // Final composite happens after the last buffer stroke.
    const lastBufStrokeIdx = log.map((e) => (e.tag === 'buf' && e.op === 'stroke' ? 1 : 0)).lastIndexOf(1)
    const lastDrawIdx = log.map((e) => (e.op === 'drawImage' ? 1 : 0)).lastIndexOf(1)
    expect(lastDrawIdx).toBeGreaterThan(lastBufStrokeIdx)
  })

  it('runs rainbow_spiral: no throw, cycles pen colors, correct net rotation', () => {
    const { turtle, interp } = makeTurtleAndInterpreter()

    expect(() => interp.run(RAINBOW_SPIRAL)).not.toThrow()

    // 150 iterations x 89deg = 13350deg -> 30deg mod 360.
    expect(((turtle.getState().heading % 360) + 360) % 360).toBeCloseTo(30)

    // Every segment stroked on the buffer, colors cycling through the palette.
    const bufStrokes = log.filter((e) => e.tag === 'buf' && e.op === 'stroke')
    expect(bufStrokes.length).toBeGreaterThanOrEqual(150)

    const stylesAtStrokeTime = new Set(bufStrokes.map((e) => e.style))
    expect(stylesAtStrokeTime.size).toBeGreaterThanOrEqual(5)

    // Background untouched by the cycling form: composites keep painting white bg.
    expect(turtle.getState().background).toBe(15)
  })
})
