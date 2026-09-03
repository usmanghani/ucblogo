/**
 * Render a SoftwareCanvas to text for a terminal.
 *
 * Two modes:
 *   - colour (default): half-block characters with 24-bit ANSI colours; every
 *     terminal cell shows two vertically stacked pixels blocks.
 *   - ascii / braille: Unicode braille dots (2x4 per cell), monochrome, for
 *     terminals or logs without colour support.
 *
 * The canvas is downsampled to the requested character grid; each cell (or
 * half-cell / dot) takes the most common non-background colour of the pixel
 * block it covers so thin lines stay visible.
 */

import type { SoftwareCanvas } from './SoftwareCanvas'

export interface RenderOptions {
  columns: number
  rows: number
  mode?: 'color' | 'braille'
  /** Background colour of the drawing, so blocks matching it render as empty. */
  background: [number, number, number]
  /** Include LABEL text overlaid at its position. */
  labels?: boolean
}

type RGB = [number, number, number]

function near(a: RGB, b: RGB, tol = 24): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol
}

/** Dominant non-background colour of a pixel block, or null if it is all background. */
function dominant(canvas: SoftwareCanvas, x0: number, y0: number, x1: number, y1: number, bg: RGB): RGB | null {
  const counts = new Map<number, number>()
  let best: RGB | null = null
  let bestCount = 0
  const xa = Math.max(0, Math.floor(x0))
  const xb = Math.min(canvas.width, Math.ceil(x1))
  const ya = Math.max(0, Math.floor(y0))
  const yb = Math.min(canvas.height, Math.ceil(y1))
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const p = canvas.pixel(x, y)
      if (near(p, bg)) continue
      const key = (p[0] << 16) | (p[1] << 8) | p[2]
      const n = (counts.get(key) ?? 0) + 1
      counts.set(key, n)
      if (n > bestCount) {
        bestCount = n
        best = p
      }
    }
  }
  return best
}

const fg = (c: RGB) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`
const bgc = (c: RGB) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m`
const RESET = '\x1b[0m'

/** Render the canvas as lines of text (without trailing newline). */
export function renderCanvas(canvas: SoftwareCanvas, opts: RenderOptions): string[] {
  const mode = opts.mode ?? 'color'
  const cols = Math.max(1, opts.columns)
  const rows = Math.max(1, opts.rows)
  const bg = opts.background
  const cellW = canvas.width / cols
  const lines: string[] = []

  if (mode === 'braille') {
    const cellH = canvas.height / rows
    for (let r = 0; r < rows; r++) {
      let line = ''
      for (let c = 0; c < cols; c++) {
        let bits = 0
        // Braille dot layout (bit index): 0 3 / 1 4 / 2 5 / 6 7
        const dotW = cellW / 2
        const dotH = cellH / 4
        const order = [0, 1, 2, 6, 3, 4, 5, 7]
        let k = 0
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 4; dy++) {
            const x0 = c * cellW + dx * dotW
            const y0 = r * cellH + dy * dotH
            if (dominant(canvas, x0, y0, x0 + dotW, y0 + dotH, bg)) bits |= 1 << order[k]
            k++
          }
        }
        line += String.fromCharCode(0x2800 + bits)
      }
      lines.push(line)
    }
  } else {
    const cellH = canvas.height / rows
    for (let r = 0; r < rows; r++) {
      let line = ''
      let lastStyle = ''
      for (let c = 0; c < cols; c++) {
        const x0 = c * cellW
        const y0 = r * cellH
        const top = dominant(canvas, x0, y0, x0 + cellW, y0 + cellH / 2, bg)
        const bottom = dominant(canvas, x0, y0 + cellH / 2, x0 + cellW, y0 + cellH, bg)
        let style: string
        let ch: string
        if (!top && !bottom) {
          style = bgc(bg)
          ch = ' '
        } else if (top && bottom) {
          style = fg(top) + bgc(bottom)
          ch = '▀'
        } else if (top) {
          style = fg(top) + bgc(bg)
          ch = '▀'
        } else {
          style = fg(bottom!) + bgc(bg)
          ch = '▄'
        }
        if (style !== lastStyle) {
          line += style
          lastStyle = style
        }
        line += ch
      }
      lines.push(line + RESET)
    }
  }

  if (opts.labels !== false && canvas.labels.length) overlayLabels(lines, canvas, cols, rows, mode === 'color')
  return lines
}

/** Print LABEL text at its approximate cell position, on top of the raster. */
function overlayLabels(lines: string[], canvas: SoftwareCanvas, cols: number, rows: number, color: boolean): void {
  const cellW = canvas.width / cols
  const cellH = canvas.height / rows
  // Work on a plain-character grid for the labelled rows, then re-colour.
  for (const label of canvas.labels) {
    const r = Math.min(rows - 1, Math.max(0, Math.floor(label.y / cellH)))
    const c = Math.min(cols - 1, Math.max(0, Math.floor(label.x / cellW)))
    const text = label.text.slice(0, Math.max(0, cols - c))
    if (!text) continue
    const plain = stripAnsi(lines[r]).padEnd(cols, ' ')
    const merged = plain.slice(0, c) + text + plain.slice(c + text.length)
    lines[r] = color ? fg(label.color) + merged + RESET : merged
  }
}

export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}
