/**
 * Turtle graphics engine.
 *
 * Renders to an HTML canvas. The turtle has position (x, y), heading (degrees,
 * 0 = up/north, increasing clockwise), pen state, color, size, and mode.
 *
 * Screen modes:
 *   WRAP   - turtle wraps around screen edges
 *   FENCE  - turtle stops at the boundary
 *   WINDOW - turtle can move off-screen freely
 *
 * The canvas uses a coordinate system where (0, 0) is the center, +x is right,
 * +y is up (matching Logo's turtle semantics). Rendering transforms to screen
 * coordinates (origin at center, y flipped).
 */

export type ScreenMode = 'WRAP' | 'FENCE' | 'WINDOW'
export type PenMode = 'PAINT' | 'ERASE' | 'REVERSE'

export interface TurtleState {
  x: number
  y: number
  heading: number
  penDown: boolean
  penColor: number
  penSize: number
  penMode: PenMode
  visible: boolean
  screenMode: ScreenMode
  background: number
}

export interface TurtleCallbacks {
  onStateChange?: (state: TurtleState) => void
}

/** Standard Logo color palette (0-15). */
export const LOGO_COLORS: Record<number, string> = {
  0: '#000000', // black
  1: '#0000aa', // blue
  2: '#00aa00', // green
  3: '#00aaaa', // cyan
  4: '#aa0000', // red
  5: '#aa00aa', // magenta
  6: '#aa5500', // brown
  7: '#aaaaaa', // light gray
  8: '#555555', // dark gray
  9: '#5555ff', // light blue
  10: '#55ff55', // light green
  11: '#55ffff', // light cyan
  12: '#ff5555', // light red
  13: '#ff55ff', // light magenta
  14: '#ffff55', // yellow
  15: '#ffffff', // white
}

export class Turtle {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  /** Offscreen layer holding pen strokes only; the turtle marker is
   *  composited on top at display time so it can move without erasing lines. */
  private buf: HTMLCanvasElement
  private bctx: CanvasRenderingContext2D
  private state: TurtleState
  private callbacks: TurtleCallbacks
  private width: number
  private height: number
  constructor(canvas: HTMLCanvasElement, callbacks: TurtleCallbacks = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.buf = document.createElement('canvas')
    this.buf.width = canvas.width
    this.buf.height = canvas.height
    this.bctx = this.buf.getContext('2d')!
    this.callbacks = callbacks
    this.width = canvas.width
    this.height = canvas.height
    this.state = {
      x: 0,
      y: 0,
      heading: 0,
      penDown: true,
      penColor: 0,
      penSize: 1,
      penMode: 'PAINT',
      visible: true,
      screenMode: 'WRAP',
      background: 15,
    }
    this.clearScreen()
    this.render()
  }

  getState(): TurtleState {
    return { ...this.state }
  }

  /** Set canvas dimensions (call on resize). */
  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    // Copy existing strokes before resizing (resizing clears a canvas).
    let saved: HTMLCanvasElement | null = null
    if (this.buf.width > 0 && this.buf.height > 0) {
      saved = document.createElement('canvas')
      saved.width = this.buf.width
      saved.height = this.buf.height
      saved.getContext('2d')!.drawImage(this.buf, 0, 0)
    }
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    this.buf.width = width
    this.buf.height = height
    this.clearScreen()
    if (saved) this.bctx.drawImage(saved, 0, 0)
    this.render()
  }

  /** Convert a Logo coordinate to screen pixel coordinates. */
  private toScreen(x: number, y: number): [number, number] {
    const sx = this.width / 2 + x
    const sy = this.height / 2 - y
    return [sx, sy]
  }

  /** Clear the drawing to the background color (CS: turtle homes too). */
  clearScreen(): void {
    this.bctx.fillStyle = LOGO_COLORS[this.state.background] ?? '#ffffff'
    this.bctx.fillRect(0, 0, this.width, this.height)
    this.bctx.lineWidth = this.state.penSize
    this.bctx.strokeStyle = LOGO_COLORS[this.state.penColor] ?? '#000000'
    this.bctx.lineCap = 'round'
    this.bctx.lineJoin = 'round'
  }

  /** Clear the drawing (same as CLEAN: keep turtle, clear lines). */
  clean(): void {
    this.clearScreen()
  }

  /** Composite the stroke buffer onto the display canvas, then the marker. */
  private render(): void {
    this.ctx.drawImage(this.buf, 0, 0)
    if (!this.state.visible) return
    const [sx, sy] = this.toScreen(this.state.x, this.state.y)
    this.ctx.save()
    this.ctx.translate(sx, sy)
    this.ctx.rotate((this.state.heading * Math.PI) / 180)
    this.ctx.fillStyle = this.state.penColor === 0 ? '#ff0000' : '#000000'
    this.ctx.strokeStyle = '#000000'
    // Triangle turtle marker.
    this.ctx.beginPath()
    this.ctx.moveTo(0, -8)
    this.ctx.lineTo(-5, 5)
    this.ctx.lineTo(5, 5)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.restore()
  }


  // --- Movement ---

  forward(distance: number): void {
    const rad = (this.state.heading * Math.PI) / 180
    const dx = Math.sin(rad) * distance
    const dy = Math.cos(rad) * distance
    this.moveTo(this.state.x + dx, this.state.y + dy)
  }

  back(distance: number): void {
    this.forward(-distance)
  }

  left(degrees: number): void {
    this.state.heading = ((this.state.heading - degrees) % 360 + 360) % 360
    this.notify()
  }

  right(degrees: number): void {
    this.state.heading = ((this.state.heading + degrees) % 360 + 360) % 360
    this.notify()
  }

  setHeading(degrees: number): void {
    this.state.heading = degrees % 360
    if (this.state.heading < 0) this.state.heading += 360
    this.notify()
  }

  setX(x: number): void {
    this.moveTo(x, this.state.y)
  }

  setY(y: number): void {
    this.moveTo(this.state.x, y)
  }

  setXY(x: number, y: number): void {
    this.moveTo(x, y)
  }

  setPos(x: number, y: number): void {
    this.moveTo(x, y)
  }

  home(): void {
    this.setXY(0, 0)
    this.setHeading(0)
  }

  /** Move to a position, drawing a line if the pen is down. */
  private moveTo(x: number, y: number): void {
    const [oldSx, oldSy] = this.toScreen(this.state.x, this.state.y)
    const [newSx, newSy] = this.toScreen(x, y)

    if (this.state.penDown) {
      this.bctx.beginPath()
      this.bctx.moveTo(oldSx, oldSy)
      this.bctx.lineTo(newSx, newSy)
      this.bctx.stroke()
    }

    this.state.x = x
    this.state.y = y
    this.notify()
  }

  // --- Pen ---

  penUp(): void {
    this.state.penDown = false
    this.notify()
  }

  penDown(): void {
    this.state.penDown = true
    this.notify()
  }

  setPenColor(color: number): void {
    this.state.penColor = color
    this.bctx.strokeStyle = LOGO_COLORS[color] ?? '#000000'
    this.notify()
  }

  setPenSize(size: number): void {
    this.state.penSize = size
    this.bctx.lineWidth = size
    this.notify()
  }

  setBackground(color: number): void {
    this.state.background = color
    this.clearScreen()
    this.notify()
  }


  /** Advance to the next palette color, skipping the background color. */
  cyclePenColor(): void {
    let c = (this.state.penColor + 1) % 16
    if (c === this.state.background) c = (c + 1) % 16
    this.setPenColor(c)
  }

  /** Next color in the palette after the pen color (does not change anything). */
  nextCycleColor(): number {
    let c = (this.state.penColor + 1) % 16
    if (c === this.state.background) c = (c + 1) % 16
    return c
  }

  setPenMode(mode: PenMode): void {
    this.state.penMode = mode
    this.notify()
  }

  // --- Visibility ---

  hideTurtle(): void {
    this.state.visible = false
    this.notify()
  }

  showTurtle(): void {
    this.state.visible = true
    this.notify()
  }

  // --- Screen modes ---

  setScreenMode(mode: ScreenMode): void {
    this.state.screenMode = mode
    this.notify()
  }

  // --- Drawing extras ---

  /** Draw an arc (angle in degrees) with the given radius. */
  arc(angle: number, radius: number): void {
    const rad = (this.state.heading * Math.PI) / 180
    const [sx, sy] = this.toScreen(this.state.x, this.state.y)
    const startAngle = -rad - Math.PI / 2
    const arcAngle = (angle * Math.PI) / 180
    if (this.state.penDown) {
      this.bctx.beginPath()
      this.bctx.arc(sx, sy, radius, startAngle, startAngle + arcAngle, angle < 0)
      this.bctx.stroke()
    }
    // Update heading and position to the arc endpoint.
    const endRad = rad + arcAngle
    this.state.heading = (this.state.heading + angle) % 360
    if (this.state.heading < 0) this.state.heading += 360
    this.state.x += Math.sin(endRad) * radius
    this.state.y += Math.cos(endRad) * radius
    this.notify()
  }

  /** Draw a filled circle of the given radius around the turtle. */
  fill(): void {
    const [sx, sy] = this.toScreen(this.state.x, this.state.y)
    this.bctx.save()
    this.bctx.fillStyle = LOGO_COLORS[this.state.penColor] ?? '#000000'
    this.bctx.beginPath()
    this.bctx.arc(sx, sy, this.state.penSize * 4, 0, Math.PI * 2)
    this.bctx.fill()
    this.bctx.restore()
  }

  /** Draw text at the turtle's position. */
  label(text: string): void {
    const [sx, sy] = this.toScreen(this.state.x, this.state.y)
    this.bctx.save()
    this.bctx.fillStyle = LOGO_COLORS[this.state.penColor] ?? '#000000'
    this.bctx.font = `${this.state.penSize * 12}px monospace`
    this.bctx.fillText(text, sx, sy)
    this.bctx.restore()
  }

  private notify(): void {
    this.render()
    this.callbacks.onStateChange?.(this.getState())
  }
}
