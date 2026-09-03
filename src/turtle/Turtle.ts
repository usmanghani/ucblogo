/**
 * Turtle graphics engine.
 *
 * Renders to an HTML canvas (or any object implementing the small subset of
 * the 2D canvas API that we use — the CLI supplies a software rasterizer).
 *
 * Supports many turtles (Terrapin-style TELL / ASK / EACH): every drawing or
 * movement command applies to all "told" turtles. Turtle 0 exists initially.
 *
 * The canvas uses a coordinate system where (0, 0) is the center, +x is right,
 * +y is up (matching Logo's turtle semantics). Rendering transforms to screen
 * coordinates (origin at center, y flipped).
 */

import { colorToCss, type LogoColor } from './colors'
export { LOGO_COLORS, colorToCss } from './colors'
export type { LogoColor } from './colors'

export type ScreenMode = 'WRAP' | 'FENCE' | 'WINDOW'
export type PenMode = 'PAINT' | 'ERASE' | 'REVERSE'

export interface TurtleState {
  id: string
  x: number
  y: number
  heading: number
  penDown: boolean
  penColor: LogoColor
  penSize: number
  penMode: PenMode
  visible: boolean
  screenMode: ScreenMode
  background: LogoColor
  shape: string
  shapeLocked: boolean
  velocity: number
  fontSize: number
  fontName: string
}

/** Minimal canvas surface the engine needs (real canvases satisfy it). */
export interface CanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): CanvasRenderingContext2D | null
}

export interface TurtleCallbacks {
  onStateChange?: (state: TurtleState) => void
  /** Factory for the offscreen stroke buffer (defaults to document.createElement). */
  createCanvas?: (width: number, height: number) => CanvasLike
}

function defaultCreateCanvas(width: number, height: number): CanvasLike {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

export class Turtle {
  private ctx: CanvasRenderingContext2D
  private canvas: CanvasLike
  /** Offscreen layer holding pen strokes only; the turtle markers are
   *  composited on top at display time so they can move without erasing lines. */
  private buf: CanvasLike
  private bctx: CanvasRenderingContext2D
  private turtles = new Map<string, TurtleState>()
  /** Ids of the turtles currently addressed by commands. */
  private told: string[] = ['0']
  private background: LogoColor = 7
  private screenMode: ScreenMode = 'WRAP'
  private callbacks: TurtleCallbacks
  private width: number
  private height: number
  /** Suppress rendering while a batch of commands runs (ASK / EACH). */
  private renderSuspended = 0

  constructor(canvas: CanvasLike, callbacks: TurtleCallbacks = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.callbacks = callbacks
    this.width = canvas.width
    this.height = canvas.height
    this.buf = (callbacks.createCanvas ?? defaultCreateCanvas)(canvas.width, canvas.height)
    this.bctx = this.buf.getContext('2d')!
    this.turtles.set('0', this.newState('0'))
    this.clearScreen()
    this.render()
  }

  private newState(id: string): TurtleState {
    return {
      id,
      x: 0,
      y: 0,
      heading: 0,
      penDown: true,
      penColor: 0,
      penSize: 1,
      penMode: 'PAINT',
      visible: true,
      screenMode: this.screenMode,
      background: this.background,
      shape: 'TURTLE',
      shapeLocked: false,
      velocity: 0,
      fontSize: 12,
      fontName: 'sans-serif',
    }
  }

  // --- Multi-turtle management ---

  /** Normalize a turtle identifier (number or name). */
  static idOf(who: number | string): string {
    return typeof who === 'number' ? String(Math.trunc(who)) : who.toUpperCase()
  }

  /** Create a turtle if it does not exist yet. */
  declare(who: number | string): void {
    const id = Turtle.idOf(who)
    if (!this.turtles.has(id)) this.turtles.set(id, this.newState(id))
  }

  /** True if a turtle with this id exists. */
  hasTurtle(who: number | string): boolean {
    return this.turtles.has(Turtle.idOf(who))
  }

  /** Address the given turtles with subsequent commands (creating them as needed). */
  tell(who: (number | string)[]): void {
    if (who.length === 0) return
    for (const w of who) this.declare(w)
    this.told = who.map((w) => Turtle.idOf(w))
    this.notify()
  }

  /** Ids of the turtles currently told. */
  who(): string[] {
    return this.told.slice()
  }

  /** Ids of all turtles. */
  allTurtles(): string[] {
    return Array.from(this.turtles.keys())
  }

  /** Ensure turtles 0..n-1 exist (Terrapin SETTURTLES). */
  setTurtleCount(n: number): void {
    for (let i = 0; i < n; i++) this.declare(i)
  }

  /** Run `fn` with a temporary set of told turtles, then restore. */
  withTold<T>(who: (number | string)[], fn: () => T): T {
    const saved = this.told
    this.renderSuspended++
    try {
      this.tell(who)
      return fn()
    } finally {
      this.told = saved
      this.renderSuspended--
      this.notify()
    }
  }

  /** Run `fn` once per told turtle with only that turtle told (EACH). */
  each(fn: (id: string) => void): void {
    const ids = this.told.slice()
    for (const id of ids) this.withTold([id], () => fn(id))
  }

  /** The primary (first told) turtle's state. */
  private get state(): TurtleState {
    return this.turtles.get(this.told[0]) ?? this.turtles.values().next().value!
  }

  private forEach(fn: (s: TurtleState) => void): void {
    for (const id of this.told) {
      const s = this.turtles.get(id)
      if (s) fn(s)
    }
  }

  getState(): TurtleState {
    return { ...this.state, background: this.background, screenMode: this.screenMode }
  }

  /** State of a specific turtle. */
  getStateOf(who: number | string): TurtleState | undefined {
    const s = this.turtles.get(Turtle.idOf(who))
    return s ? { ...s, background: this.background, screenMode: this.screenMode } : undefined
  }

  /** Set canvas dimensions (call on resize). */
  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    // Copy existing strokes before resizing (resizing clears a canvas).
    let saved: CanvasLike | null = null
    if (this.buf.width > 0 && this.buf.height > 0) {
      saved = (this.callbacks.createCanvas ?? defaultCreateCanvas)(this.buf.width, this.buf.height)
      saved.getContext('2d')!.drawImage(this.buf as unknown as CanvasImageSource, 0, 0)
    }
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    this.buf.width = width
    this.buf.height = height
    this.clearScreen()
    if (saved) this.bctx.drawImage(saved as unknown as CanvasImageSource, 0, 0)
    this.render()
  }

  /** Convert a Logo coordinate to screen pixel coordinates. */
  private toScreen(x: number, y: number): [number, number] {
    const sx = this.width / 2 + x
    const sy = this.height / 2 - y
    return [sx, sy]
  }

  /** Clear the drawing to the background color. */
  clearScreen(): void {
    this.bctx.globalCompositeOperation = 'source-over'
    this.bctx.fillStyle = colorToCss(this.background)
    this.bctx.fillRect(0, 0, this.width, this.height)
    this.bctx.lineCap = 'round'
    this.bctx.lineJoin = 'round'
    this.render()
  }

  /** Clear the drawing (same as CLEAN: keep turtles, clear lines). */
  clean(): void {
    this.clearScreen()
  }

  /** Composite the stroke buffer onto the display canvas, then the markers. */
  private render(): void {
    if (this.renderSuspended > 0) return
    this.ctx.drawImage(this.buf as unknown as CanvasImageSource, 0, 0)
    for (const s of this.turtles.values()) {
      if (!s.visible) continue
      this.drawMarker(this.ctx, s)
    }
  }

  private drawMarker(ctx: CanvasRenderingContext2D, s: TurtleState): void {
    const [sx, sy] = this.toScreen(s.x, s.y)
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate((s.heading * Math.PI) / 180)
    const pen = colorToCss(s.penColor)
    ctx.fillStyle = pen === colorToCss(this.background) ? '#ff0000' : pen
    ctx.strokeStyle = pen === '#000000' ? '#ffffff' : '#000000'
    ctx.lineWidth = 1
    // Triangle turtle marker.
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(-5, 5)
    ctx.lineTo(5, 5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  /** Apply a turtle's pen settings to the stroke buffer context. */
  private applyPen(s: TurtleState): void {
    this.bctx.lineWidth = s.penSize
    if (s.penMode === 'ERASE') {
      this.bctx.globalCompositeOperation = 'source-over'
      this.bctx.strokeStyle = colorToCss(this.background)
      this.bctx.fillStyle = colorToCss(this.background)
    } else if (s.penMode === 'REVERSE') {
      this.bctx.globalCompositeOperation = 'difference'
      this.bctx.strokeStyle = '#ffffff'
      this.bctx.fillStyle = '#ffffff'
    } else {
      this.bctx.globalCompositeOperation = 'source-over'
      this.bctx.strokeStyle = colorToCss(s.penColor)
      this.bctx.fillStyle = colorToCss(s.penColor)
    }
  }

  // --- Movement ---

  forward(distance: number): void {
    this.forEach((s) => {
      const rad = (s.heading * Math.PI) / 180
      this.moveTurtle(s, s.x + Math.sin(rad) * distance, s.y + Math.cos(rad) * distance)
    })
    this.notify()
  }

  back(distance: number): void {
    this.forward(-distance)
  }

  left(degrees: number): void {
    this.forEach((s) => { s.heading = normalizeHeading(s.heading - degrees) })
    this.notify()
  }

  right(degrees: number): void {
    this.forEach((s) => { s.heading = normalizeHeading(s.heading + degrees) })
    this.notify()
  }

  setHeading(degrees: number): void {
    this.forEach((s) => { s.heading = normalizeHeading(degrees) })
    this.notify()
  }

  setX(x: number): void {
    this.forEach((s) => this.moveTurtle(s, x, s.y))
    this.notify()
  }

  setY(y: number): void {
    this.forEach((s) => this.moveTurtle(s, s.x, y))
    this.notify()
  }

  setXY(x: number, y: number): void {
    this.forEach((s) => this.moveTurtle(s, x, y))
    this.notify()
  }

  setPos(x: number, y: number): void {
    this.setXY(x, y)
  }

  home(): void {
    this.forEach((s) => {
      this.moveTurtle(s, 0, 0)
      s.heading = 0
    })
    this.notify()
  }

  /** Heading from the primary turtle towards a point. */
  towards(x: number, y: number): number {
    const s = this.state
    const dx = x - s.x
    const dy = y - s.y
    if (dx === 0 && dy === 0) return s.heading
    return normalizeHeading((Math.atan2(dx, dy) * 180) / Math.PI)
  }

  /** Distance from the primary turtle to a point. */
  distance(x: number, y: number): number {
    const s = this.state
    return Math.hypot(x - s.x, y - s.y)
  }

  /** Move one turtle to a position, drawing a line if its pen is down. */
  private moveTurtle(s: TurtleState, x: number, y: number): void {
    if (this.screenMode === 'FENCE') {
      const hw = this.width / 2
      const hh = this.height / 2
      x = Math.max(-hw, Math.min(hw, x))
      y = Math.max(-hh, Math.min(hh, y))
    }
    if (s.penDown) {
      this.applyPen(s)
      if (this.screenMode === 'WRAP') {
        this.drawWrapped(s.x, s.y, x, y)
      } else {
        const [oldSx, oldSy] = this.toScreen(s.x, s.y)
        const [newSx, newSy] = this.toScreen(x, y)
        this.bctx.beginPath()
        this.bctx.moveTo(oldSx, oldSy)
        this.bctx.lineTo(newSx, newSy)
        this.bctx.stroke()
      }
    }
    if (this.screenMode === 'WRAP') {
      const hw = this.width / 2
      const hh = this.height / 2
      x = wrapCoord(x, hw)
      y = wrapCoord(y, hh)
    }
    s.x = x
    s.y = y
  }

  /** Draw a segment, wrapping around the edges of the canvas. */
  private drawWrapped(x0: number, y0: number, x1: number, y1: number): void {
    const hw = this.width / 2
    const hh = this.height / 2
    // Iteratively split the segment at the first boundary crossing.
    let guard = 0
    while (guard++ < 64) {
      const dx = x1 - x0
      const dy = y1 - y0
      let tMin = 1
      let axis: 'x' | 'y' | null = null
      let bound = 0
      if (dx !== 0) {
        for (const b of [-hw, hw]) {
          const t = (b - x0) / dx
          if (t > 1e-9 && t < tMin && Math.sign(dx) === Math.sign(b)) { tMin = t; axis = 'x'; bound = b }
        }
      }
      if (dy !== 0) {
        for (const b of [-hh, hh]) {
          const t = (b - y0) / dy
          if (t > 1e-9 && t < tMin && Math.sign(dy) === Math.sign(b)) { tMin = t; axis = 'y'; bound = b }
        }
      }
      const [sx0, sy0] = this.toScreen(x0, y0)
      if (!axis) {
        const [sx1, sy1] = this.toScreen(x1, y1)
        this.bctx.beginPath()
        this.bctx.moveTo(sx0, sy0)
        this.bctx.lineTo(sx1, sy1)
        this.bctx.stroke()
        return
      }
      const mx = x0 + dx * tMin
      const my = y0 + dy * tMin
      const [smx, smy] = this.toScreen(mx, my)
      this.bctx.beginPath()
      this.bctx.moveTo(sx0, sy0)
      this.bctx.lineTo(smx, smy)
      this.bctx.stroke()
      // Continue from the opposite edge.
      if (axis === 'x') {
        const shift = bound > 0 ? -this.width : this.width
        x0 = mx + shift
        y0 = my
        x1 = x1 + shift
      } else {
        const shift = bound > 0 ? -this.height : this.height
        x0 = mx
        y0 = my + shift
        y1 = y1 + shift
      }
    }
  }

  // --- Pen ---

  penUp(): void {
    this.forEach((s) => { s.penDown = false })
    this.notify()
  }

  penDown(): void {
    this.forEach((s) => { s.penDown = true })
    this.notify()
  }

  setPenColor(color: LogoColor): void {
    this.forEach((s) => { s.penColor = color })
    this.notify()
  }

  setPenSize(size: number): void {
    this.forEach((s) => { s.penSize = Math.max(0.5, size) })
    this.notify()
  }

  setBackground(color: LogoColor): void {
    this.background = color
    this.clearScreen()
    this.notify()
  }

  /** Advance to the next palette color, skipping the background color. */
  cyclePenColor(): void {
    this.setPenColor(this.nextCycleColor())
  }

  /** Next color in the palette after the pen color (does not change anything). */
  nextCycleColor(): number {
    const cur = typeof this.state.penColor === 'number' ? this.state.penColor : 0
    let c = (cur + 1) % 16
    if (c === this.background) c = (c + 1) % 16
    return c
  }

  setPenMode(mode: PenMode): void {
    this.forEach((s) => { s.penMode = mode })
    this.notify()
  }

  // --- Visibility ---

  hideTurtle(): void {
    this.forEach((s) => { s.visible = false })
    this.notify()
  }

  showTurtle(): void {
    this.forEach((s) => { s.visible = true })
    this.notify()
  }

  // --- Screen modes ---

  setScreenMode(mode: ScreenMode): void {
    this.screenMode = mode
    for (const s of this.turtles.values()) s.screenMode = mode
    this.notify()
  }

  // --- Shapes / attributes (Terrapin) ---

  setShape(shape: string): void {
    this.forEach((s) => { s.shape = shape })
    this.notify()
  }

  lockShape(locked = true): void {
    this.forEach((s) => { s.shapeLocked = locked })
  }

  setVelocity(v: number): void {
    this.forEach((s) => { s.velocity = v })
  }

  setFont(name: string, size: number): void {
    this.forEach((s) => {
      s.fontName = name
      if (size > 0) s.fontSize = size
    })
  }

  // --- Drawing extras ---

  /** Draw an arc (angle in degrees) with the given radius, centred on the turtle. */
  arc(angle: number, radius: number): void {
    this.forEach((s) => {
      if (!s.penDown) return
      this.applyPen(s)
      const rad = (s.heading * Math.PI) / 180
      const [sx, sy] = this.toScreen(s.x, s.y)
      const startAngle = rad - Math.PI / 2
      const arcAngle = (angle * Math.PI) / 180
      this.bctx.beginPath()
      this.bctx.arc(sx, sy, radius, startAngle, startAngle + arcAngle, angle < 0)
      this.bctx.stroke()
    })
    this.notify()
  }

  /** Flood-fill-ish: paint a filled disc at the turtle (approximation of FILL). */
  fill(): void {
    this.forEach((s) => {
      const [sx, sy] = this.toScreen(s.x, s.y)
      this.applyPen(s)
      this.bctx.beginPath()
      this.bctx.arc(sx, sy, s.penSize * 4, 0, Math.PI * 2)
      this.bctx.fill()
    })
    this.notify()
  }

  /** Draw a dot of the given diameter at the turtle position (pen state ignored). */
  dot(size: number): void {
    this.forEach((s) => {
      const [sx, sy] = this.toScreen(s.x, s.y)
      this.applyPen(s)
      this.bctx.beginPath()
      this.bctx.arc(sx, sy, Math.max(0.5, size / 2), 0, Math.PI * 2)
      this.bctx.fill()
    })
    this.notify()
  }

  /** Draw an ellipse centred on the turtle (Terrapin STAMPOVAL). */
  stampOval(width: number, height: number, filled: boolean): void {
    this.forEach((s) => {
      const [sx, sy] = this.toScreen(s.x, s.y)
      this.applyPen(s)
      this.bctx.beginPath()
      const rot = (s.heading * Math.PI) / 180
      this.bctx.ellipse(sx, sy, Math.abs(width) / 2, Math.abs(height) / 2, rot, 0, Math.PI * 2)
      if (filled) this.bctx.fill()
      else this.bctx.stroke()
    })
    this.notify()
  }

  /** Draw a rectangle centred on the turtle (Terrapin STAMPRECT). */
  stampRect(width: number, height: number, filled: boolean): void {
    this.forEach((s) => {
      const [sx, sy] = this.toScreen(s.x, s.y)
      this.applyPen(s)
      this.bctx.save()
      this.bctx.translate(sx, sy)
      this.bctx.rotate((s.heading * Math.PI) / 180)
      this.bctx.beginPath()
      this.bctx.rect(-width / 2, -height / 2, width, height)
      if (filled) this.bctx.fill()
      else this.bctx.stroke()
      this.bctx.restore()
    })
    this.notify()
  }

  /** Stamp the turtle marker onto the drawing. */
  stamp(): void {
    this.forEach((s) => this.drawMarker(this.bctx, s))
    this.notify()
  }

  /** Draw text at the turtle's position, along its heading. */
  label(text: string): void {
    this.forEach((s) => {
      const [sx, sy] = this.toScreen(s.x, s.y)
      this.applyPen(s)
      this.bctx.save()
      this.bctx.translate(sx, sy)
      this.bctx.rotate(((s.heading - 90) * Math.PI) / 180)
      this.bctx.font = `${s.fontSize}px ${s.fontName}`
      this.bctx.fillText(text, 0, 0)
      this.bctx.restore()
    })
    this.notify()
  }

  private notify(): void {
    this.render()
    this.callbacks.onStateChange?.(this.getState())
  }
}

function normalizeHeading(h: number): number {
  const n = h % 360
  return n < 0 ? n + 360 : n
}

function wrapCoord(v: number, half: number): number {
  if (v > half) return v - 2 * half * Math.ceil((v - half) / (2 * half))
  if (v < -half) return v + 2 * half * Math.ceil((-half - v) / (2 * half))
  return v
}
