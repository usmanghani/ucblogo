import type { TurtleState } from '../turtle/Turtle'
import { colorToCss, type LogoColor } from '../turtle/Turtle'

interface StatusBarProps {
  state: TurtleState | null
}

export function StatusBar({ state }: StatusBarProps) {
  if (!state) return null

  return (
    <div className="status-bar">
      <span>
        x: {format(state.x)} y: {format(state.y)}
      </span>
      <span>heading: {format(state.heading)}°</span>
      <span>pen: {state.penDown ? 'down' : 'up'}</span>
      <span>
        pen color: <span className="color-swatch" style={{ backgroundColor: getLogoColor(state.penColor) }} />
      </span>
      <span>mode: {state.screenMode}</span>
    </div>
  )
}

function format(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

function getLogoColor(c: LogoColor): string {
  return colorToCss(c)
}
