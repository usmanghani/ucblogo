/**
 * Turtle graphics primitives.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { isNumber, isList, LogoList, toLogoString } from '../types'
import { badInput } from '../errors'
import type { Turtle } from '../../turtle/Turtle'
import { LOGO_COLORS } from '../../turtle/Turtle'

function num(v: LogoValue, name: string): number {
  if (isNumber(v)) return v
  throw badInput(name, v)
}

function turtle(ctx: EvalContext): Turtle {
  if (!ctx.turtle) throw new Error('Turtle graphics not available')
  return ctx.turtle as Turtle
}

/** Register all turtle primitives. */
export function registerTurtle(ev: Evaluator, ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  // Movement
  reg('FORWARD', 1, 1, (args) => { turtle(ctx).forward(num(args[0], 'FORWARD')); return '' })
  reg('FD', 1, 1, (args) => { turtle(ctx).forward(num(args[0], 'FD')); return '' })
  reg('BACK', 1, 1, (args) => { turtle(ctx).back(num(args[0], 'BACK')); return '' })
  reg('BK', 1, 1, (args) => { turtle(ctx).back(num(args[0], 'BK')); return '' })
  reg('LEFT', 1, 1, (args) => { turtle(ctx).left(num(args[0], 'LEFT')); return '' })
  reg('LT', 1, 1, (args) => { turtle(ctx).left(num(args[0], 'LT')); return '' })
  reg('RIGHT', 1, 1, (args) => { turtle(ctx).right(num(args[0], 'RIGHT')); return '' })
  reg('RT', 1, 1, (args) => { turtle(ctx).right(num(args[0], 'RT')); return '' })

  reg('SETXY', 2, 2, (args) => { turtle(ctx).setXY(num(args[0], 'SETXY'), num(args[1], 'SETXY')); return '' })
  reg('SETPOS', 1, 1, (args) => {
    const p = args[0]
    if (isList(p) && p.items.length >= 2) {
      turtle(ctx).setPos(num(p.items[0], 'SETPOS'), num(p.items[1], 'SETPOS'))
    } else {
      throw badInput('SETPOS', p)
    }
    return ''
  })
  reg('SETX', 1, 1, (args) => { turtle(ctx).setX(num(args[0], 'SETX')); return '' })
  reg('SETY', 1, 1, (args) => { turtle(ctx).setY(num(args[0], 'SETY')); return '' })
  reg('SETHEADING', 1, 1, (args) => { turtle(ctx).setHeading(num(args[0], 'SETHEADING')); return '' })
  reg('SETH', 1, 1, (args) => { turtle(ctx).setHeading(num(args[0], 'SETH')); return '' })
  reg('HOME', 0, 0, () => { turtle(ctx).home(); return '' })

  // Pen
  reg('PENUP', 0, 0, () => { turtle(ctx).penUp(); return '' })
  reg('PU', 0, 0, () => { turtle(ctx).penUp(); return '' })
  reg('PENDOWN', 0, 0, () => { turtle(ctx).penDown(); return '' })
  reg('PD', 0, 0, () => { turtle(ctx).penDown(); return '' })
  reg('SETPENCOLOR', 1, 1, (args) => { turtle(ctx).setPenColor(num(args[0], 'SETPENCOLOR')); return '' })
  reg('SETPC', 1, 1, (args) => { turtle(ctx).setPenColor(num(args[0], 'SETPC')); return '' })
  reg('SETBACKGROUND', 1, 1, (args) => { turtle(ctx).setBackground(num(args[0], 'SETBACKGROUND')); return '' })
  reg('SETBG', 1, 1, (args) => { turtle(ctx).setBackground(num(args[0], 'SETBG')); return '' })
  reg('SETPENSIZE', 1, 1, (args) => { turtle(ctx).setPenSize(num(args[0], 'SETPENSIZE')); return '' })
  reg('SETPEN', 1, 1, (args) => {
    const p = args[0]
    if (isList(p) && p.items.length >= 2) {
      turtle(ctx).setPenColor(num(p.items[0], 'SETPEN'))
      turtle(ctx).setPenSize(num(p.items[1], 'SETPEN'))
    } else {
      throw badInput('SETPEN', p)
    }
    return ''
  })
  reg('SETPENMODE', 1, 1, (args) => {
    const m = toLogoString(args[0]).toUpperCase()
    const t = turtle(ctx)
    if (m === 'PAINT' || m === 'ERASE' || m === 'REVERSE') {
      ;(t as unknown as { setPenMode: (m: string) => void }).setPenMode(m)
    } else {
      throw badInput('SETPENMODE', args[0])
    }
    return ''
  })
  reg('PENMODE', 0, 0, () => turtle(ctx).getState().penMode)

  // Display
  reg('CLEARSCREEN', 0, 0, () => { turtle(ctx).clearScreen(); return '' })
  reg('CS', 0, 0, () => { turtle(ctx).clearScreen(); return '' })
  reg('CLEAN', 0, 0, () => { turtle(ctx).clean(); return '' })
  reg('HIDETURTLE', 0, 0, () => { turtle(ctx).hideTurtle(); return '' })
  reg('HT', 0, 0, () => { turtle(ctx).hideTurtle(); return '' })
  reg('SHOWTURTLE', 0, 0, () => { turtle(ctx).showTurtle(); return '' })
  reg('ST', 0, 0, () => { turtle(ctx).showTurtle(); return '' })

  reg('ARC', 2, 2, (args) => { turtle(ctx).arc(num(args[0], 'ARC'), num(args[1], 'ARC')); return '' })
  reg('LABEL', 1, 1, (args) => { turtle(ctx).label(toLogoString(args[0])); return '' })
  reg('FILL', 0, 0, () => { turtle(ctx).fill(); return '' })

  // Queries
  reg('GETXY', 0, 0, () => {
    const s = turtle(ctx).getState()
    return new LogoList([s.x, s.y])
  })
  reg('XCOR', 0, 0, () => turtle(ctx).getState().x)
  reg('YCOR', 0, 0, () => turtle(ctx).getState().y)
  reg('HEADING', 0, 0, () => turtle(ctx).getState().heading)
  reg('PENCOLOR', 0, 0, () => turtle(ctx).getState().penColor)
  reg('PC', 0, 0, () => turtle(ctx).getState().penColor)
  reg('BACKGROUND', 0, 0, () => turtle(ctx).getState().background)
  reg('BG', 0, 0, () => turtle(ctx).getState().background)
  reg('PENSIZE', 0, 0, () => turtle(ctx).getState().penSize)
  reg('SHOWNP', 0, 0, () => turtle(ctx).getState().visible)
  reg('TURTLEP', 0, 0, () => true)
  reg('PENDOWNP', 0, 0, () => turtle(ctx).getState().penDown)

  // Screen modes
  reg('WINDOW', 0, 0, () => { turtle(ctx).setScreenMode('WINDOW'); return '' })
  reg('WRAP', 0, 0, () => { turtle(ctx).setScreenMode('WRAP'); return '' })
  reg('FENCE', 0, 0, () => { turtle(ctx).setScreenMode('FENCE'); return '' })

  // Palette
  reg('SETPALETTE', 2, 2, (args) => {
    // SETPALETTE colornum [r g b]
    const c = num(args[0], 'SETPALETTE')
    const v = args[1]
    if (isList(v) && v.items.length >= 3) {
      const r = Math.round((num(v.items[0], 'SETPALETTE') * 255) / 100)
      const g = Math.round((num(v.items[1], 'SETPALETTE') * 255) / 100)
      const b = Math.round((num(v.items[2], 'SETPALETTE') * 255) / 100)
      LOGO_COLORS[c] = `rgb(${r},${g},${b})`
    }
    return ''
  })
  reg('PALETTE', 1, 1, (args) => {
    const c = num(args[0], 'PALETTE')
    const color = LOGO_COLORS[c] ?? '#000000'
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/)
    if (match) {
      return new LogoList([
        Math.round((parseInt(match[1]) * 100) / 255),
        Math.round((parseInt(match[2]) * 100) / 255),
        Math.round((parseInt(match[3]) * 100) / 255),
      ])
    }
    return new LogoList([0, 0, 0])
  })

  reg('SETSCRUNCH', 1, 1, (args) => { num(args[0], 'SETSCRUNCH'); return '' })
  reg('SCRUNCH', 0, 0, () => 1)
  reg('SETLABELHEIGHT', 1, 1, (args) => { num(args[0], 'SETLABELHEIGHT'); return '' })
  reg('LABELSIZE', 0, 0, () => 1)

  // Display modes
  reg('TEXTSCREEN', 0, 0, () => { turtle(ctx).setScreenMode('WRAP'); return '' })
  reg('SPLITSCREEN', 0, 0, () => { turtle(ctx).setScreenMode('WRAP'); return '' })
  reg('FULLSCREENS', 0, 0, () => { turtle(ctx).setScreenMode('WRAP'); return '' })
  reg('DRAW', 0, 0, () => { turtle(ctx).clearScreen(); return '' })

  // Pen pattern (no bitmap pattern in browser; accept and ignore)
  reg('PENPATTERN', 0, 0, () => 0)
  reg('SETPENPATTERN', 1, 1, () => '')

  // Picture save/load (no bitmap persistence; no-op returning the name)
  reg('SAVEPICT', 1, 1, (args) => toLogoString(args[0]))
  reg('LOADPICT', 1, 1, (args) => toLogoString(args[0]))
}

