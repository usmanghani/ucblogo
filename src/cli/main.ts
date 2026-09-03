/**
 * UCBLogo Web command-line interface.
 *
 *   ucblogo program.lgo            run a Logo program, print its text output,
 *                                  then draw the turtle graphics in the terminal
 *   ucblogo program.lgb            .lgb block programs are plain Logo too
 *   ucblogo                        interactive REPL (type ? for help)
 *   ucblogo -e "REPEAT 4 [FD 50 RT 90]"
 *
 * Options:
 *   --width N --height N   logical canvas size in turtle steps (default 800x600)
 *   --cols N --rows N      terminal cells to use (default: terminal size)
 *   --ascii                monochrome braille output instead of colour blocks
 *   --no-graphics          text output only
 *   --png FILE             also write the drawing as a PPM/PNG-compatible image (PPM)
 *   --steps N              abort after N evaluation steps (default 50,000,000)
 */

import { readFileSync, writeFileSync, readSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Interpreter, formatError } from '../interpreter/interpreter'
import { LogoError } from '../interpreter/errors'
import { Turtle } from '../turtle/Turtle'
import { colorToRgb } from '../turtle/colors'
import { SoftwareCanvas } from './SoftwareCanvas'
import { renderCanvas } from './terminal'

interface CliOptions {
  file?: string
  expr?: string
  width: number
  height: number
  cols?: number
  rows?: number
  ascii: boolean
  graphics: boolean
  ppm?: string
  steps: number
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = { width: 800, height: 600, ascii: false, graphics: true, steps: 50_000_000, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--width': o.width = Number(next()); break
      case '--height': o.height = Number(next()); break
      case '--cols': o.cols = Number(next()); break
      case '--rows': o.rows = Number(next()); break
      case '--ascii': case '--braille': o.ascii = true; break
      case '--no-graphics': case '--text': o.graphics = false; break
      case '--ppm': case '--png': o.ppm = next(); break
      case '--steps': o.steps = Number(next()); break
      case '-e': case '--eval': o.expr = next(); break
      case '-h': case '--help': o.help = true; break
      default:
        if (a.startsWith('-')) {
          process.stderr.write(`Unknown option ${a}\n`)
          o.help = true
        } else o.file = a
    }
  }
  return o
}

const USAGE = `Usage: ucblogo [options] [program.lgo | program.lgb]

Runs a Logo program (or starts a REPL) and draws the turtle graphics in the
terminal. Files saved from the Blocks editor (.lgb) run unchanged.

Options:
  -e, --eval CODE       run CODE instead of a file
  --width N             canvas width in turtle steps (default 800)
  --height N            canvas height in turtle steps (default 600)
  --cols N, --rows N    terminal cells to draw into (default: terminal size)
  --ascii               monochrome braille graphics (no colour codes)
  --no-graphics         do not draw the canvas, text output only
  --ppm FILE            also save the drawing as a binary PPM image
  --steps N             step budget before aborting a runaway program
  -h, --help            show this help
`

/** Synchronous line read from stdin (for READ / READLIST inside programs). */
function readLineSync(): string | undefined {
  const buf = Buffer.alloc(1)
  let line = ''
  while (true) {
    let n = 0
    try {
      n = readSync(0, buf, 0, 1, null)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EAGAIN') continue
      if ((e as NodeJS.ErrnoException).code === 'EOF') break
      throw e
    }
    if (n === 0) break
    const ch = buf.toString('utf8')
    if (ch === '\n') return line
    if (ch !== '\r') line += ch
  }
  return line === '' ? undefined : line
}

export interface Session {
  interp: Interpreter
  turtle: Turtle
  display: SoftwareCanvas
  opts: CliOptions
}

export function createSession(opts: CliOptions): Session {
  const display = new SoftwareCanvas(opts.width, opts.height)
  const turtle = new Turtle(display, { createCanvas: (w, h) => new SoftwareCanvas(w, h) })
  const interp = new Interpreter({
    turtle,
    onOutput: (s) => process.stdout.write(s),
    onClearText: () => {
      if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H')
    },
    readLine: readLineSync,
  })
  interp.evaluator.maxSteps = opts.steps
  return { interp, turtle, display, opts }
}

/** Draw the current canvas to stdout. */
export function drawGraphics(s: Session): void {
  if (!s.opts.graphics) return
  const cols = s.opts.cols ?? Math.max(20, (process.stdout.columns ?? 80) - 1)
  const rows = s.opts.rows ?? Math.max(8, Math.floor((cols * s.display.height) / s.display.width / 2))
  const bg = colorToRgb(s.turtle.getState().background)
  const lines = renderCanvas(s.display, { columns: cols, rows, mode: s.opts.ascii ? 'braille' : 'color', background: bg })
  process.stdout.write(lines.join('\n') + '\n')
  s.display.dirty = false
}

/** Save the canvas as a binary PPM (P6) image. */
export function writePpm(s: Session, file: string): void {
  const { width, height, data } = s.display
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii')
  const body = Buffer.alloc(width * height * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    body[j] = data[i]
    body[j + 1] = data[i + 1]
    body[j + 2] = data[i + 2]
  }
  writeFileSync(file, Buffer.concat([header, body]))
}

/** Run source text; returns true on success. */
export function runSource(s: Session, source: string): boolean {
  try {
    const result = s.interp.runOrThrow(source)
    if (result) process.stdout.write(result + '\n')
    return true
  } catch (e) {
    if (e instanceof LogoError) {
      process.stderr.write(formatError(e) + '\n')
      const line = e.line
      if (line !== undefined) {
        const src = source.split('\n')[line - 1]
        if (src !== undefined) process.stderr.write(`  ${line} | ${src.trim()}\n`)
      }
      return false
    }
    throw e
  }
}

function repl(s: Session): void {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
  process.stdout.write('UCBLogo Web CLI. Type Logo instructions; :help for commands, :quit to exit.\n')
  let buffer: string[] = []
  const prompt = () => rl.setPrompt(buffer.length ? '> ' : '? ')
  prompt()
  rl.prompt()
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (buffer.length === 0 && trimmed.startsWith(':')) {
      const cmd = trimmed.slice(1).toLowerCase()
      if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
        rl.close()
        return
      }
      if (cmd === 'help' || cmd === 'h') {
        process.stdout.write(':draw   redraw the graphics\n:clear  clear screen (CS)\n:load FILE  run a .lgo/.lgb file\n:quit   exit\nMulti-line TO ... END definitions are supported.\n')
      } else if (cmd === 'draw') {
        drawGraphics(s)
      } else if (cmd === 'clear') {
        s.turtle.clearScreen()
        drawGraphics(s)
      } else if (cmd.startsWith('load ')) {
        const file = trimmed.slice(6).trim()
        try {
          runSource(s, readFileSync(file, 'utf8'))
          drawGraphics(s)
        } catch (e) {
          process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
        }
      } else {
        process.stdout.write(`Unknown command ${trimmed}\n`)
      }
      prompt()
      rl.prompt()
      return
    }
    // Collect TO ... END definitions across lines.
    buffer.push(line)
    const joined = buffer.join('\n')
    const opensDef = /^\s*TO\s/i.test(buffer[0])
    const closed = !opensDef || /^\s*END\s*$/im.test(joined)
    if (!closed) {
      prompt()
      rl.prompt()
      return
    }
    buffer = []
    runSource(s, joined)
    if (s.display.dirty) drawGraphics(s)
    prompt()
    rl.prompt()
  })
  rl.on('close', () => {
    process.stdout.write('\n')
    process.exit(0)
  })
}

export function main(argv = process.argv.slice(2)): void {
  const opts = parseArgs(argv)
  if (opts.help) {
    process.stdout.write(USAGE)
    process.exit(opts.help && argv.length && !argv.includes('-h') && !argv.includes('--help') ? 2 : 0)
  }
  const session = createSession(opts)
  if (opts.expr !== undefined || opts.file) {
    let source = opts.expr ?? ''
    if (opts.file) {
      try {
        source = readFileSync(opts.file, 'utf8')
      } catch (e) {
        process.stderr.write(`Cannot read ${opts.file}: ${e instanceof Error ? e.message : String(e)}\n`)
        process.exit(1)
      }
    }
    const ok = runSource(session, source)
    drawGraphics(session)
    if (opts.ppm) writePpm(session, opts.ppm)
    process.exit(ok ? 0 : 1)
  }
  repl(session)
}
