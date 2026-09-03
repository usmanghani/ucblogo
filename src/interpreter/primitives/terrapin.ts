/**
 * Terrapin Logo / Apple Logo compatibility primitives.
 *
 * These cover the dialect used by the Terrapin Logo Program Library so those
 * programs load and run: PR, CT, TT, multi-turtle TELL/ASK/EACH, STAMPOVAL,
 * STAMPRECT, SETWIDTH, LOCAL/LMAKE, DECLARE/PPROPS, ALIAS, WAIT, PLAY and
 * friends. Features that need real hardware or a windowing system (sound,
 * widgets, background threads, keyboard polling) are accepted and treated as
 * no-ops so programs using them still run headless.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoList, LogoArray, isList, isNumber, isWord, toLogoString, logoEqual } from '../types'
import { badInput, LogoError } from '../errors'
import { Environment } from '../environment'
import type { Turtle } from '../../turtle/Turtle'
import { parseColor, labelText } from './turtle_prims'
import { COLOR_NAMES, PALETTE_NAMES } from '../../turtle/colors'

function num(v: LogoValue, name: string): number {
  if (isNumber(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  throw badInput(name, v)
}

function turtle(ctx: EvalContext): Turtle {
  if (!ctx.turtle) throw new LogoError('Turtle graphics not available', 'USER')
  return ctx.turtle as Turtle
}

/** Turtle identifiers from a TELL/ASK input: number, name, or list of them. */
function whoList(v: LogoValue): (number | string)[] {
  if (isList(v)) return v.items.flatMap(whoList)
  if (isNumber(v)) return [v]
  if (isWord(v)) return [v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v]
  return []
}

/** Render values the way PR does: lists without brackets, joined by spaces. */
function printText(v: LogoValue): string {
  if (isList(v)) return v.items.map(printText).join(' ')
  return toLogoString(v)
}

/** Register the Terrapin compatibility layer. */
export function registerTerrapin(ev: Evaluator, ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }
  const noop = (name: string, minArgs: number, maxArgs: number) => reg(name, minArgs, maxArgs, () => '')

  const startTime = Date.now()
  /** Declared non-turtle objects (widgets, bitmaps): name -> type. */
  const objects = new Map<string, string>()
  const declaredTurtle = (who: LogoValue): boolean => {
    if (isNumber(who)) return true
    if (isWord(who)) {
      const t = ctx.turtle as Turtle | undefined
      if (t && t.hasTurtle(who)) return true
      return objects.get(who.toUpperCase()) === 'TURTLE'
    }
    return false
  }

  // --- Text output ---
  reg('PR', 1, -1, (args) => {
    ctx.output(args.map(printText).join(' ') + '\n')
    return ''
  })
  for (const n of ['CT', 'CLEARTEXT']) reg(n, 0, 0, () => { ctx.clearText?.(); return '' })
  for (const n of ['TT', 'TURTLETEXT']) reg(n, 1, 1, (args) => { turtle(ctx).label(labelText(args[0])); return '' })
  reg('SETFONT', 1, 3, (args) => {
    const t = turtle(ctx)
    if (isList(args[0])) {
      const [name, size] = args[0].items
      t.setFont(toLogoString(name ?? 'sans-serif'), isNumber(size) ? size : 0)
    } else {
      t.setFont(toLogoString(args[0]), args[1] !== undefined ? num(args[1], 'SETFONT') : 0)
    }
    return ''
  })
  reg('SETTEXTSIZE', 1, 1, (args) => { turtle(ctx).setFont('sans-serif', num(args[0], 'SETTEXTSIZE')); return '' })
  reg('ALERT', 1, 1, (args) => { ctx.output(`[Alert] ${printText(args[0])}\n`); return '' })
  reg('SAY', 1, 2, (args) => { ctx.output(`[Say] ${printText(args[0])}\n`); return '' })

  // --- Input (no interactive source when headless) ---
  reg('READ', 0, 0, () => {
    const line = ctx.readLine?.()
    return line === undefined ? '' : line
  })
  reg('RC', 0, 0, () => ctx.readLine?.()?.charAt(0) ?? '')
  reg('RL', 0, 0, () => {
    const line = ctx.readLine?.()
    return new LogoList(line ? line.split(/\s+/) : [])
  })
  for (const n of ['KEY?', 'KEYP', 'MOUSEDOWN?', 'BUTTON?', 'BUTTONP']) reg(n, 0, 0, () => false)
  reg('MOUSE', 0, 0, () => new LogoList([0, 0]))
  reg('MOUSEPOS', 0, 0, () => new LogoList([0, 0]))

  // --- Screen ---
  for (const n of ['FS', 'FULLSCREEN', 'SS', 'TS']) noop(n, 0, 0)

  // --- Pen ---
  for (const n of ['SETW', 'SETWIDTH', 'SETPENWIDTH', 'SETPW']) {
    reg(n, 1, 1, (args) => { turtle(ctx).setPenSize(num(args[0], n)); return '' })
  }
  for (const n of ['WIDTH', 'PENWIDTH', 'PW']) reg(n, 0, 0, () => turtle(ctx).getState().penSize)
  for (const n of ['PX', 'PENREVERSE']) reg(n, 0, 0, () => { turtle(ctx).setPenMode('REVERSE'); return '' })
  for (const n of ['PE', 'PENERASE']) reg(n, 0, 0, () => { turtle(ctx).setPenMode('ERASE'); return '' })
  for (const n of ['PPT', 'PENPAINT', 'PENNORMAL']) reg(n, 0, 0, () => { turtle(ctx).setPenMode('PAINT'); return '' })
  reg('DOT', 0, 2, (args) => {
    const t = turtle(ctx)
    let a = args[0]
    if (args.length === 2) a = new LogoList([args[0], args[1]])
    if (isList(a) && a.items.length >= 2) {
      const s = t.getState()
      const wasDown = s.penDown
      t.penUp()
      t.setXY(num(a.items[0], 'DOT'), num(a.items[1], 'DOT'))
      t.dot(s.penSize)
      t.setXY(s.x, s.y)
      if (wasDown) t.penDown()
      return ''
    }
    t.dot(a === undefined ? t.getState().penSize : num(a, 'DOT'))
    return ''
  })
  reg('STAMPOVAL', 2, 3, (args) => {
    turtle(ctx).stampOval(num(args[0], 'STAMPOVAL'), num(args[1], 'STAMPOVAL'), truthyArg(args[2]))
    return ''
  })
  reg('STAMPRECT', 2, 3, (args) => {
    turtle(ctx).stampRect(num(args[0], 'STAMPRECT'), num(args[1], 'STAMPRECT'), truthyArg(args[2]))
    return ''
  })
  reg('STAMP', 0, 0, () => { turtle(ctx).stamp(); return '' })
  reg('DOT?', 0, 1, () => false)
  reg('DOTP', 0, 1, () => false)
  reg('COLORUNDER', 0, 0, () => turtle(ctx).getState().background)
  reg('COLORS', 0, 0, () => new LogoList(COLOR_NAMES))
  reg('PALETTECOLORS', 0, 0, () => new LogoList(PALETTE_NAMES))

  // --- Position queries ---
  reg('POS', 0, 0, () => {
    const s = turtle(ctx).getState()
    return new LogoList([s.x, s.y])
  })
  reg('TOWARDS', 1, 2, (args) => {
    const t = turtle(ctx)
    if (args.length === 2) return t.towards(num(args[0], 'TOWARDS'), num(args[1], 'TOWARDS'))
    const p = args[0]
    if (isList(p) && p.items.length >= 2) return t.towards(num(p.items[0], 'TOWARDS'), num(p.items[1], 'TOWARDS'))
    if (isWord(p) || isNumber(p)) {
      const other = t.getStateOf(p)
      if (other) return t.towards(other.x, other.y)
    }
    throw badInput('TOWARDS', p)
  })
  reg('DISTANCE', 1, 2, (args) => {
    const t = turtle(ctx)
    if (args.length === 2) return t.distance(num(args[0], 'DISTANCE'), num(args[1], 'DISTANCE'))
    const p = args[0]
    if (isList(p) && p.items.length >= 2) return t.distance(num(p.items[0], 'DISTANCE'), num(p.items[1], 'DISTANCE'))
    if (isWord(p) || isNumber(p)) {
      const other = t.getStateOf(p)
      if (other) return t.distance(other.x, other.y)
    }
    throw badInput('DISTANCE', p)
  })

  // --- Multiple turtles ---
  reg('TELL', 1, 1, (args) => {
    const who = whoList(args[0])
    if (who.length === 0) {
      if (isList(args[0])) return '' // TELL []: nobody is addressed
      throw badInput('TELL', args[0])
    }
    turtle(ctx).tell(who)
    return ''
  })
  reg('TELLALL', 0, 2, (args) => {
    const t = turtle(ctx)
    if (args.length === 2) {
      const lo = num(args[0], 'TELLALL')
      const hi = num(args[1], 'TELLALL')
      const ids: number[] = []
      for (let i = lo; i <= hi; i++) ids.push(i)
      t.tell(ids)
      return ''
    }
    t.tell(t.allTurtles())
    return ''
  })
  reg('WHO', 0, 0, () => {
    const ids = turtle(ctx).who().map((id) => (isNaN(Number(id)) ? id : Number(id)))
    return ids.length === 1 ? ids[0] : new LogoList(ids)
  })
  // .WHO always outputs the told turtles as a list.
  reg('.WHO', 0, 0, () => new LogoList(turtle(ctx).who().map((id) => (isNaN(Number(id)) ? id : Number(id)))))
  reg('TURTLES', 0, 0, () => turtle(ctx).allTurtles().filter((id) => !isNaN(Number(id))).length)
  reg('ALLTURTLES', 0, 0, () => new LogoList(turtle(ctx).allTurtles().map((id) => (isNaN(Number(id)) ? id : Number(id)))))
  for (const n of ['SETTURTLES', 'SETT']) reg(n, 1, 1, (args) => { turtle(ctx).setTurtleCount(num(args[0], n)); return '' })
  reg('BOUNDS', 0, 0, () => {
    const c = (turtle(ctx) as unknown as { width: number; height: number })
    return new LogoList([Math.floor(c.width / 2), Math.floor(c.height / 2)])
  })
  // The graphics panel is addressable as an object with a DRAWSIZE property.
  {
    const c = ctx.turtle as unknown as { width: number; height: number } | undefined
    Environment.setProp('GRAPHICS', 'DRAWSIZE', new LogoList([c?.width ?? 800, c?.height ?? 600]))
    Environment.setProp('GRAPHICS', 'SIZE', new LogoList([c?.width ?? 800, c?.height ?? 600]))
    Environment.setProp('GRAPHICS', 'WRAPMODE', 'WRAP')
    Environment.setProp('SCREEN', 'COLORS', new LogoList(PALETTE_NAMES))
    ctx.env.setGlobal('CURRENT.GRAPHICS', 'GRAPHICS')
  }
  for (const n of ['ARCR', 'ARCL']) {
    reg(n, 2, 2, (args) => {
      // ARCR radius angle: arc to the right (left) of the given angle, moving the turtle.
      const t = turtle(ctx)
      const radius = num(args[0], n)
      const angle = num(args[1], n)
      const steps = Math.max(1, Math.ceil(Math.abs(angle) / 5))
      const stepLen = (2 * Math.PI * radius * Math.abs(angle) / 360) / steps
      const turn = angle / steps
      for (let i = 0; i < steps; i++) {
        t.forward(stepLen)
        if (n === 'ARCR') t.right(turn)
        else t.left(turn)
      }
      return ''
    })
  }
  noop('SETBGPATTERN', 1, 1)
  noop('SETBOUNDS', 1, 1)
  noop('SETSPEED', 1, 1)
  noop('SETPENPATTERN.TERRAPIN', 1, 1)
  // Dotted comparison / arithmetic operators (Terrapin).
  reg('.LT', 2, 2, (args) => num(args[0], '.LT') < num(args[1], '.LT'))
  reg('.GT', 2, 2, (args) => num(args[0], '.GT') > num(args[1], '.GT'))
  reg('.LE', 2, 2, (args) => num(args[0], '.LE') <= num(args[1], '.LE'))
  reg('.GE', 2, 2, (args) => num(args[0], '.GE') >= num(args[1], '.GE'))
  reg('.EQ', 2, 2, (args) => logoEqual(args[0], args[1]))
  reg('.NE', 2, 2, (args) => !logoEqual(args[0], args[1]))
  reg('ASK', 2, 2, (args) => {
    const who = args[0]
    const body = args[1]
    const items = isList(body) ? body.items : [body]
    if (declaredTurtle(who) || (isList(who) && who.items.every(declaredTurtle))) {
      return turtle(ctx).withTold(whoList(who), () => ev.evalTemplate(items, ctx.env))
    }
    // A widget or other object: just run the instructions.
    return ev.evalTemplate(items, ctx.env)
  })
  reg('EACH', 1, 1, (args) => {
    const body = args[0]
    const items = isList(body) ? body.items : [body]
    const env = ctx.env
    let result: LogoValue = ''
    turtle(ctx).each(() => { result = ev.evalTemplate(items, env) })
    return result
  })
  reg('DECLARE', 2, 2, (args) => {
    const type = toLogoString(args[0]).toUpperCase()
    const name = toLogoString(args[1]).toUpperCase()
    if (type === 'TURTLE') turtle(ctx).declare(name)
    objects.set(name, type)
    return ''
  })
  reg('DECLARED?', 1, 1, (args) => objects.has(toLogoString(args[0]).toUpperCase()) || turtle(ctx).hasTurtle(toLogoString(args[0])))
  reg('SETSHAPE', 0, 1, (args) => { turtle(ctx).setShape(args[0] === undefined ? 'TURTLE' : toLogoString(args[0])); return '' })
  reg('LOADSHAPE', 1, 1, (args) => { turtle(ctx).setShape(toLogoString(args[0])); return '' })
  reg('SHAPE', 0, 0, () => turtle(ctx).getState().shape)
  reg('LOCKSHAPE', 0, 0, () => { turtle(ctx).lockShape(true); return '' })
  reg('UNLOCKSHAPE', 0, 0, () => { turtle(ctx).lockShape(false); return '' })
  reg('SNAP', 2, 3, (args) => (args[2] !== undefined ? toLogoString(args[2]) : 'SNAP'))
  reg('LOADSNAP', 1, 1, (args) => toLogoString(args[0]))
  reg('SAVESNAP', 1, 2, (args) => toLogoString(args[0]))
  for (const n of ['SETTS', 'SETTURTLESIZE']) noop(n, 1, 1)
  reg('TURTLESIZE', 0, 0, () => 1)
  reg('SETVELOCITY', 1, 1, (args) => { turtle(ctx).setVelocity(num(args[0], 'SETVELOCITY')); return '' })
  reg('VELOCITY', 0, 0, () => turtle(ctx).getState().velocity)
  for (const n of ['SETXVEL', 'SETYVEL', 'SETROTATION', 'SETSPIN', 'BOUNCE', 'FREEZE', 'UNFREEZE']) noop(n, n.startsWith('SET') ? 1 : 0, n.startsWith('SET') ? 1 : 0)

  // --- Events, threads, timing, sound (no-ops headless) ---
  noop('WHEN', 2, 2)
  reg('LAUNCH', 1, 1, () => ++launchId)
  noop('HALT', 0, 1)
  noop('HALTALL', 0, 0)
  noop('WAIT', 1, 1)
  noop('PAUSE', 0, 0)
  noop('PLAY', 1, 1)
  noop('TONE', 2, 2)
  noop('BEEP', 0, 0)
  noop('SETTIMER', 1, 2)
  noop('CLEARTIMER', 0, 1)
  for (const n of ['MILLISECONDS', 'TIMEMILLI']) reg(n, 0, 0, () => Date.now() - startTime)
  reg('TIMER', 0, 0, () => Date.now() - startTime)
  reg('TIME', 0, 0, () => {
    const d = new Date()
    return new LogoList([d.getHours(), d.getMinutes(), d.getSeconds()])
  })
  reg('DATE', 0, 0, () => {
    const d = new Date()
    return new LogoList([d.getFullYear(), d.getMonth() + 1, d.getDate()])
  })

  // --- Workspace ---
  reg('LOCAL', 1, -1, (args) => {
    for (const a of args) {
      if (isList(a)) a.items.forEach((n) => ctx.env.set(toLogoString(n).toUpperCase(), ''))
      else ctx.env.set(toLogoString(a).toUpperCase(), '')
    }
    return ''
  })
  for (const n of ['LMAKE', 'LOCALMAKE']) {
    reg(n, 2, 2, (args) => {
      ctx.env.set(toLogoString(args[0]).toUpperCase(), args[1])
      return ''
    })
  }
  reg('GLOBAL', 1, -1, (args) => {
    for (const a of args) {
      const name = toLogoString(a).toUpperCase()
      if (!ctx.env.has(name)) ctx.env.setGlobal(name, '')
    }
    return ''
  })
  reg('PPROPS', 2, 2, (args) => {
    const plist = toLogoString(args[0])
    const pairs = args[1]
    if (!isList(pairs)) throw badInput('PPROPS', pairs)
    for (let i = 0; i + 1 < pairs.items.length; i += 2) {
      Environment.setProp(plist, toLogoString(pairs.items[i]).replace(/^"/, ''), pairs.items[i + 1])
    }
    return ''
  })
  reg('ALIAS', 2, 2, (args) => {
    // ALIAS existing.name new.name
    const oldName = toLogoString(args[0]).toUpperCase()
    const newName = toLogoString(args[1]).toUpperCase()
    const proc = Environment.getProc(oldName)
    if (proc) {
      Environment.setProc(newName, { ...proc, name: newName })
      return ''
    }
    const prim = ev.getPrimitive(oldName)
    if (prim) {
      ev.registerPrimitive({ ...prim, name: newName })
      return ''
    }
    throw new LogoError(`I don't know how to ${oldName}`, 'NO_HOW')
  })
  reg('IGNORE', 1, 1, () => '')
  reg('QUOTE', 1, 1, (args) => args[0])
  reg('ERROR', 0, 0, () => (ctx.env.has('__LAST_ERROR__') ? ctx.env.get('__LAST_ERROR__') : new LogoList([])))

  // --- Predicates / list helpers (? spellings) ---
  const alias = (newName: string, oldName: string) => {
    const prim = ev.getPrimitive(oldName)
    if (prim) ev.registerPrimitive({ ...prim, name: newName })
  }
  alias('EMPTY?', 'EMPTYP')
  alias('EQUAL?', 'EQUALP')
  alias('LIST?', 'LISTP')
  alias('WORD?', 'WORDP')
  alias('NUMBER?', 'NUMBERP')
  alias('MEMBER?', 'MEMBERP')
  alias('ARRAY?', 'ARRAYP')
  alias('BEFORE?', 'BEFOREP')
  alias('PENDOWN?', 'PENDOWNP')
  alias('SHOWN?', 'SHOWNP')
  alias('NOTEQUAL?', 'NOTEQUALP')
  alias('LESS?', 'LESSP')
  alias('GREATER?', 'GREATERP')
  alias('SUBSTRING?', 'SUBSTRINGP')
  alias('DEFINED?', 'DEFINEDP')
  alias('PROCEDURE?', 'PROCEDUREP')
  alias('PRIMITIVE?', 'PRIMITIVEP')
  alias('EOF?', 'EOFP')
  reg('NAMEP', 1, 1, (args) => ctx.env.has(toLogoString(args[0]).toUpperCase()))
  alias('NAME?', 'NAMEP')
  alias('THING?', 'NAMEP')
  reg('BUTMEMBER', 2, 2, (args) => {
    const x = args[0]
    const l = isNumber(args[1]) ? new LogoList([args[1]]) : args[1]
    if (isList(l)) return new LogoList(l.items.filter((i) => !logoEqual(i, x)))
    if (isWord(l)) return l.split('').filter((c) => !logoEqual(c, x)).join('')
    throw badInput('BUTMEMBER', l)
  })
  reg('REMOVE', 2, 2, (args) => {
    const x = args[0]
    const l = args[1]
    if (isList(l)) return new LogoList(l.items.filter((i) => !logoEqual(i, x)))
    if (isWord(l)) return l.split('').filter((c) => !logoEqual(c, x)).join('')
    throw badInput('REMOVE', l)
  })
  reg('PI', 0, 0, () => Math.PI)
  reg('RANDOM', 1, 2, (args) => {
    if (args.length === 2) {
      const lo = Math.ceil(num(args[0], 'RANDOM'))
      const hi = Math.floor(num(args[1], 'RANDOM'))
      return lo + Math.floor(Math.random() * (hi - lo + 1))
    }
    const a = args[0]
    if (isList(a) && a.items.length >= 2) {
      const lo = Math.ceil(num(a.items[0], 'RANDOM'))
      const hi = Math.floor(num(a.items[1], 'RANDOM'))
      return lo + Math.floor(Math.random() * (hi - lo + 1))
    }
    // Terrapin: RANDOM n outputs 1..n (the library relies on this, e.g. as an ITEM index).
    const n = Math.floor(num(a, 'RANDOM'))
    return n <= 0 ? 0 : 1 + Math.floor(Math.random() * n)
  })
  reg('RANDOM0', 1, 1, (args) => {
    const n = Math.floor(num(args[0], 'RANDOM0'))
    return n <= 0 ? 0 : Math.floor(Math.random() * n)
  })
  reg('AGET', 2, 2, (args) => {
    const a = args[0]
    if (!(a instanceof LogoArray)) throw badInput('AGET', a)
    try { return a.get(num(args[1], 'AGET')) } catch { throw badInput('AGET', args[1]) }
  })
  reg('APUT', 3, 3, (args) => {
    const a = args[0]
    if (!(a instanceof LogoArray)) throw badInput('APUT', a)
    try { a.set(num(args[1], 'APUT'), args[2]) } catch { throw badInput('APUT', args[1]) }
    return ''
  })
  reg('PEN', 0, 0, () => {
    const s = turtle(ctx).getState()
    const mode = !s.penDown ? 'PENUP' : s.penMode === 'ERASE' ? 'PENERASE' : s.penMode === 'REVERSE' ? 'PENREVERSE' : 'PENDOWN'
    return new LogoList([mode, typeof s.penColor === 'number' ? s.penColor : s.penColor.toUpperCase(), s.penSize])
  })
  reg('COLORINDEX', 1, 1, (args) => {
    const c = parseColor(args[0], 'COLORINDEX')
    if (typeof c === 'number') return c
    const idx = PALETTE_NAMES.indexOf(c.toUpperCase())
    return idx >= 0 ? idx : -1
  })
  // Turtles expose their attributes as properties (GPROP "name "POSITION ...).
  const baseGprop = ev.getPrimitive('GPROP')!
  const basePprop = ev.getPrimitive('PPROP')!
  const turtleProp = (who: string, prop: string): LogoValue | undefined => {
    const t = ctx.turtle as Turtle | undefined
    if (!t || !t.hasTurtle(who)) return undefined
    const s = t.getStateOf(who)!
    switch (prop) {
      case 'POSITION': case 'POS': case 'XY': return new LogoList([s.x, s.y])
      case 'XCOR': return s.x
      case 'YCOR': return s.y
      case 'HEADING': return s.heading
      case 'PENCOLOR': return s.penColor
      case 'SHAPE': return s.shape
      case 'VISIBLE': case 'SHOWN': return s.visible
      case 'PENDOWN': return s.penDown
      case 'WIDTH': case 'PENWIDTH': return s.penSize
      case 'VELOCITY': return s.velocity
      default: return undefined
    }
  }
  ev.registerPrimitive({
    ...baseGprop,
    fn: (args, c) => {
      const v = baseGprop.fn(args, c)
      if (isList(v) && v.items.length === 0) {
        const tv = turtleProp(toLogoString(args[0]).toUpperCase(), toLogoString(args[1]).toUpperCase())
        if (tv !== undefined) return tv
      }
      return v
    },
  })
  ev.registerPrimitive({
    ...basePprop,
    fn: (args, c) => {
      const who = toLogoString(args[0])
      const prop = toLogoString(args[1]).toUpperCase()
      const t = ctx.turtle as Turtle | undefined
      if (t && t.hasTurtle(who) && (prop === 'POSITION' || prop === 'POS' || prop === 'XY') && isList(args[2]) && args[2].items.length >= 2) {
        const [x, y] = args[2].items
        t.withTold([who], () => { t.penUp(); t.setXY(num(x, 'PPROP'), num(y, 'PPROP')) })
      } else if (t && t.hasTurtle(who) && prop === 'HEADING') {
        t.withTold([who], () => t.setHeading(num(args[2], 'PPROP')))
      }
      return basePprop.fn(args, c)
    },
  })
  reg('SETPC.NAME', 1, 1, (args) => { turtle(ctx).setPenColor(parseColor(args[0], 'SETPC')); return '' })

  // --- Widgets (accepted, no UI headless) ---
  for (const n of ['LBAPPEND', 'LBREMOVE', 'LBINSERT', 'SETTEXT', 'SETVALUE', 'SETSIZE', 'SETPOSITION', 'SETTOOLTIP', 'SETCHECKED', 'SETMIN', 'SETMAX', 'SETSTEP', 'SETCAPTION']) noop(n, 1, 1)
  for (const n of ['LBCLEAR', 'FOCUS', 'ENABLE', 'DISABLE', 'SHOW.OBJECT', 'HIDE.OBJECT']) noop(n, 0, 0)
  reg('LBCOUNT', 0, 0, () => 0)
  reg('LBSELECTION', 0, 0, () => -1)
  reg('LBITEM', 1, 1, () => '')
  reg('VALUE', 0, 0, () => 0)
  reg('CHECKED?', 0, 0, () => false)
  reg('SIZE', 0, 0, () => new LogoList([0, 0]))
  reg('POSITION', 0, 0, () => new LogoList([0, 0]))
  reg('TEXT.OF', 0, 0, () => '')
}

let launchId = 0

function truthyArg(v: LogoValue | undefined): boolean {
  if (v === undefined) return false
  if (typeof v === 'boolean') return v
  if (isWord(v)) return v.toUpperCase() === 'TRUE'
  if (isNumber(v)) return v !== 0
  return false
}
