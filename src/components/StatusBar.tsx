import type { TurtleState } from '../turtle/Turtle'
import { LOGO_COLORS } from '../turtle/Turtle'

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
  // Round first, so float dust from turning never shows as "100.0" or "-0.0".
  const rounded = Math.round(n * 10) / 10 + 0
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getLogoColor(index: number): string {
  return LOGO_COLORS[index] ?? '#000000'
}
