/**
 * Parity suite: every program in the Terrapin Logo Program Library
 * (https://resources.terrapinlogo.com/logolib/) must load and run without an
 * interpreter error.
 *
 * Programs are run headless with a step budget. Programs that are inherently
 * non-terminating (animation loops, games waiting on input) are allowed to end
 * by exhausting the budget, but any other LogoError is a failure.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'
import { LogoError } from '../src/interpreter/errors'

const DIR = join(__dirname, 'fixtures', 'logolib')

/** Programs whose main loop never ends by design (FOREVER / event loops). */
const NON_TERMINATING = new Set<string>([
  'animation_demo.lgo', // MAIN ends by calling MAIN again
  'hermann_grid.lgo', // FOREVER [RANDOM.HERMANN.GRID WAIT 5000 DRAW]
  'tictactoe.lgo', // waits for a key press (RC) in a loop
  'single_line.lgo', // finite but draws ~2.3 million segments (720 x 3200 nested FOR)
  'clock.lgo', // REPEAT 43200 [... WAIT 1000]: a 12-hour clock
  'mandelbrot.lgo', // finite but iterates the Mandelbrot set over every pixel
  'onekey.lgo', // keyboard loop on RC
  'piano.lgo', // waits for mouse clicks on the keys
  'turtle_count.lgo', // guessing game: loops until the typed guess matches
])

function makeInterp() {
  const canvasCtx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '', font: '', globalCompositeOperation: '',
    fillRect: () => {}, clearRect: () => {}, drawImage: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    stroke: () => {}, arc: () => {}, ellipse: () => {}, rect: () => {}, fill: () => {}, translate: () => {},
    rotate: () => {}, closePath: () => {}, save: () => {}, restore: () => {}, fillText: () => {}, strokeRect: () => {},
    measureText: () => ({ width: 0 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as unknown as CanvasRenderingContext2D
  const canvas = { width: 800, height: 600, getContext: () => canvasCtx } as unknown as HTMLCanvasElement
  const turtle = new Turtle(canvas)
  const output: string[] = []
  // Programs that READ from the keyboard get a fixed answer so they can proceed.
  const interp = new Interpreter({ turtle, onOutput: (s) => output.push(s), readLine: () => '5' })
  interp.evaluator.maxSteps = 2_000_000
  return { interp, turtle, output }
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.lgo')).sort()

describe('Terrapin Logo program library', () => {
  for (const file of files) {
    it(file, () => {
      const { interp, output } = makeInterp()
      const source = readFileSync(join(DIR, file), 'utf8')
      let error: LogoError | null = null
      try {
        interp.runOrThrow(source)
      } catch (e) {
        if (e instanceof LogoError) error = e
        else throw e
      }
      if (error && error.code === 'STEP_LIMIT') {
        // Only acceptable for programs that intentionally loop forever.
        expect(NON_TERMINATING.has(file), `${file} hit the step limit: ${error.message}`).toBe(true)
        return
      }
      if (error) {
        const where = error.line ? ` (line ${error.line}${error.procName ? ` in ${error.procName}` : ''})` : ''
        throw new Error(`${file}: ${error.message}${where}\n--- output ---\n${output.join('')}`)
      }
    })
  }
})
