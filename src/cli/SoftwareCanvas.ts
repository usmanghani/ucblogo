/**
 * A tiny software rasterizer implementing the subset of the HTML canvas 2D
 * API that the turtle engine uses, so the interpreter can draw without a
 * browser (CLI, tests). Pixels are RGBA in a Uint8ClampedArray.
 */

import type { CanvasLike } from '../turtle/Turtle'
import { colorToRgb } from '../turtle/colors'

type RGB = [number, number, number]
type Point = [number, number]

interface TextLabel {
  x: number
  y: number
  text: string
  color: RGB
}

export class SoftwareCanvas implements CanvasLike {
  private _width: number
  private _height: number
  data: Uint8ClampedArray
  /** Text drawn with fillText, kept separately so the terminal can print it legibly. */
  labels: TextLabel[] = []
  /** Set whenever something is drawn; cleared by the renderer. */
  dirty = true
  private context: SoftwareContext

  constructor(width: number, height: number) {
    this._width = Math.max(1, Math.floor(width))
    this._height = Math.max(1, Math.floor(height))
    this.data = new Uint8ClampedArray(this._width * this._height * 4)
    this.context = new SoftwareContext(this)
  }

  get width(): number {
    return this._width
  }

  set width(w: number) {
    this.resize(w, this._height)
  }

  get height(): number {
    return this._height
  }

  set height(h: number) {
    this.resize(this._width, h)
  }

  private resize(w: number, h: number): void {
    this._width = Math.max(1, Math.floor(w))
    this._height = Math.max(1, Math.floor(h))
    this.data = new Uint8ClampedArray(this._width * this._height * 4)
    this.labels = []
    this.dirty = true
  }

  getContext(_kind: '2d'): CanvasRenderingContext2D {
    return this.context as unknown as CanvasRenderingContext2D
  }

  /** Read a pixel as [r, g, b]. */
  pixel(x: number, y: number): RGB {
    const i = (y * this._width + x) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2]]
  }
}

/** Parse a CSS colour into RGB (named colours, #hex, rgb()). */
export function parseCss(css: string): RGB {
  return colorToRgb(css)
}

class SoftwareContext {
  fillStyle: string = '#000000'
  strokeStyle: string = '#000000'
  lineWidth = 1
  lineCap = 'round'
  lineJoin = 'round'
  font = '12px sans-serif'
  globalCompositeOperation = 'source-over'

  private canvas: SoftwareCanvas
  /** Current transform: [a, b, c, d, e, f] as in the canvas spec. */
  private m: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]
  private stack: { m: [number, number, number, number, number, number]; fill: string; stroke: string; lw: number; op: string }[] = []
  private subpaths: Point[][] = []
  private current: Point[] | null = null

  constructor(canvas: SoftwareCanvas) {
    this.canvas = canvas
  }

  // --- State ---

  save(): void {
    this.stack.push({ m: [...this.m], fill: this.fillStyle, stroke: this.strokeStyle, lw: this.lineWidth, op: this.globalCompositeOperation })
  }

  restore(): void {
    const s = this.stack.pop()
    if (!s) return
    this.m = s.m
    this.fillStyle = s.fill
    this.strokeStyle = s.stroke
    this.lineWidth = s.lw
    this.globalCompositeOperation = s.op
  }

  translate(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m
    this.m = [a, b, c, d, a * x + c * y + e, b * x + d * y + f]
  }

  rotate(angle: number): void {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const [a, b, c, d, e, f] = this.m
    this.m = [a * cos + c * sin, b * cos + d * sin, -a * sin + c * cos, -b * sin + d * cos, e, f]
  }

  scale(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m
    this.m = [a * x, b * x, c * y, d * y, e, f]
  }

  private tx(x: number, y: number): Point {
    const [a, b, c, d, e, f] = this.m
    return [a * x + c * y + e, b * x + d * y + f]
  }

  // --- Paths ---

  beginPath(): void {
    this.subpaths = []
    this.current = null
  }

  moveTo(x: number, y: number): void {
    this.current = [this.tx(x, y)]
    this.subpaths.push(this.current)
  }

  lineTo(x: number, y: number): void {
    if (!this.current) {
      this.moveTo(x, y)
      return
    }
    this.current.push(this.tx(x, y))
  }

  closePath(): void {
    if (this.current && this.current.length > 1) {
      this.current.push(this.current[0])
      this.current = null
    }
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.closePath()
  }

  arc(x: number, y: number, r: number, start: number, end: number, anticlockwise = false): void {
    this.ellipse(x, y, r, r, 0, start, end, anticlockwise)
  }

  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise = false): void {
    let sweep = end - start
    if (anticlockwise) {
      if (sweep > 0) sweep -= 2 * Math.PI
    } else if (sweep < 0) sweep += 2 * Math.PI
    if (Math.abs(sweep) > 2 * Math.PI) sweep = Math.sign(sweep) * 2 * Math.PI
    const steps = Math.max(8, Math.ceil((Math.abs(sweep) * Math.max(rx, ry)) / 3))
    const cr = Math.cos(rotation)
    const sr = Math.sin(rotation)
    for (let i = 0; i <= steps; i++) {
      const t = start + (sweep * i) / steps
      const px = rx * Math.cos(t)
      const py = ry * Math.sin(t)
      const wx = x + px * cr - py * sr
      const wy = y + px * sr + py * cr
      if (i === 0 && !this.current) this.moveTo(wx, wy)
      else this.lineTo(wx, wy)
    }
  }

  // --- Painting ---

  private blend(x: number, y: number, rgb: RGB): void {
    const c = this.canvas
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return
    const i = (y * c.width + x) * 4
    const d = c.data
    if (this.globalCompositeOperation === 'difference') {
      d[i] = Math.abs(d[i] - rgb[0])
      d[i + 1] = Math.abs(d[i + 1] - rgb[1])
      d[i + 2] = Math.abs(d[i + 2] - rgb[2])
    } else {
      d[i] = rgb[0]
      d[i + 1] = rgb[1]
      d[i + 2] = rgb[2]
    }
    d[i + 3] = 255
    c.dirty = true
  }

  private disc(cx: number, cy: number, radius: number, rgb: RGB): void {
    if (radius <= 0.75) {
      this.blend(Math.round(cx), Math.round(cy), rgb)
      return
    }
    const r2 = radius * radius
    const x0 = Math.floor(cx - radius)
    const x1 = Math.ceil(cx + radius)
    const y0 = Math.floor(cy - radius)
    const y1 = Math.ceil(cy + radius)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        if (dx * dx + dy * dy <= r2) this.blend(x, y, rgb)
      }
    }
  }

  private segment(p: Point, q: Point, rgb: RGB, width: number): void {
    const [x0, y0] = p
    const [x1, y1] = q
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    const radius = Math.max(0.5, width / 2)
    const steps = Math.max(1, Math.ceil(len / Math.max(0.5, radius * 0.6)))
    if (width <= 1.5) {
      // Bresenham-style stepping, one pixel wide.
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        this.blend(Math.round(x0 + dx * t), Math.round(y0 + dy * t), rgb)
      }
      return
    }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.disc(x0 + dx * t, y0 + dy * t, radius, rgb)
    }
  }

  stroke(): void {
    const rgb = parseCss(this.strokeStyle)
    const width = this.lineWidth * this.scaleFactor()
    for (const path of this.subpaths) {
      if (path.length === 1) {
        this.disc(path[0][0], path[0][1], Math.max(0.5, width / 2), rgb)
        continue
      }
      for (let i = 0; i + 1 < path.length; i++) this.segment(path[i], path[i + 1], rgb, width)
    }
  }

  fill(): void {
    const rgb = parseCss(this.fillStyle)
    for (const path of this.subpaths) {
      if (path.length < 3) continue
      this.fillPolygon(path, rgb)
    }
  }

  /** Even-odd scanline polygon fill. */
  private fillPolygon(path: Point[], rgb: RGB): void {
    const pts = path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1] ? path.slice(0, -1) : path
    if (pts.length < 3) return
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of pts) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const c = this.canvas
    const yStart = Math.max(0, Math.floor(minY))
    const yEnd = Math.min(c.height - 1, Math.ceil(maxY))
    for (let y = yStart; y <= yEnd; y++) {
      const sy = y + 0.5
      const xs: number[] = []
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[(i + 1) % pts.length]
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
          xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0))
        }
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.round(xs[i]))
        const xb = Math.min(c.width - 1, Math.round(xs[i + 1]))
        for (let x = xa; x <= xb; x++) this.blend(x, y, rgb)
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const rgb = parseCss(this.fillStyle)
    const [ax, ay] = this.tx(x, y)
    const [bx, by] = this.tx(x + w, y + h)
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx)))
    const x1 = Math.min(this.canvas.width - 1, Math.ceil(Math.max(ax, bx)) - 1)
    const y0 = Math.max(0, Math.floor(Math.min(ay, by)))
    const y1 = Math.min(this.canvas.height - 1, Math.ceil(Math.max(ay, by)) - 1)
    const full = x0 === 0 && y0 === 0 && x1 === this.canvas.width - 1 && y1 === this.canvas.height - 1
    if (full) this.canvas.labels = []
    const op = this.globalCompositeOperation
    this.globalCompositeOperation = 'source-over'
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) this.blend(xx, yy, rgb)
    this.globalCompositeOperation = op
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    const saved = this.fillStyle
    this.fillStyle = '#ffffff'
    this.fillRect(x, y, w, h)
    this.fillStyle = saved
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.beginPath()
    this.rect(x, y, w, h)
    this.stroke()
  }

  fillText(text: string, x: number, y: number): void {
    const [px, py] = this.tx(x, y)
    this.canvas.labels.push({ x: px, y: py, text, color: parseCss(this.fillStyle) })
    // Also mark the baseline so the text area shows up in the raster.
    const rgb = parseCss(this.fillStyle)
    const size = parseInt(this.font, 10) || 12
    const w = text.length * size * 0.6
    for (let i = 0; i < w; i += 2) this.blend(Math.round(px + i), Math.round(py), rgb)
    this.canvas.dirty = true
  }

  measureText(text: string): { width: number } {
    const size = parseInt(this.font, 10) || 12
    return { width: text.length * size * 0.6 }
  }

  drawImage(src: unknown, dx: number, dy: number): void {
    const s = src as SoftwareCanvas
    if (!(s instanceof SoftwareCanvas)) return
    const c = this.canvas
    const w = Math.min(s.width, c.width - dx)
    const h = Math.min(s.height, c.height - dy)
    for (let y = 0; y < h; y++) {
      const srcRow = y * s.width * 4
      const dstRow = ((y + dy) * c.width + dx) * 4
      c.data.set(s.data.subarray(srcRow, srcRow + w * 4), dstRow)
    }
    c.labels = s.labels.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }))
    c.dirty = true
  }

  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray; width: number; height: number } {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let yy = 0; yy < h; yy++) {
      const srcRow = ((y + yy) * this.canvas.width + x) * 4
      out.set(this.canvas.data.subarray(srcRow, srcRow + w * 4), yy * w * 4)
    }
    return { data: out, width: w, height: h }
  }

  private scaleFactor(): number {
    const [a, b] = this.m
    return Math.hypot(a, b) || 1
  }
}
