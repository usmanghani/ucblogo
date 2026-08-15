/**
 * I/O primitives: PRINT, SHOW, TYPE, file operations.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { isList, isWord, LogoList, toLogoString } from '../types'
import { Environment } from '../environment'
import { tokenize } from '../lexer'
import { parse } from '../parser'

/** Register all I/O primitives. */
export function registerIO(ev: Evaluator, ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  reg('PRINT', 1, 1, (args) => {
    ctx.output(renderForPrint(args[0]) + '\n')
    return ''
  })

  reg('SHOW', 1, 1, (args) => {
    ctx.output(renderForShow(args[0]) + '\n')
    return ''
  })

  reg('TYPE', 1, 1, (args) => {
    ctx.output(renderForPrint(args[0]))
    return ''
  })

  reg('READLIST', 0, 0, () => {
    // In the web REPL, READLIST is handled by the REPL loop.
    return new LogoList([])
  })

  reg('READWORD', 0, 0, () => '')
  reg('READCHAR', 0, 0, () => '')

  // File operations (use virtual FS if available).
  reg('OPENREAD', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) (ctx.fs as { openRead: (n: string) => void }).openRead(name)
    return ''
  })
  reg('OPENWRITE', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) (ctx.fs as { openWrite: (n: string) => void }).openWrite(name)
    return ''
  })
  reg('OPENAPPEND', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) (ctx.fs as { openAppend: (n: string) => void }).openAppend(name)
    return ''
  })
  reg('CLOSE', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) (ctx.fs as { close: (n: string) => void }).close(name)
    return ''
  })
  reg('CLOSEALL', 0, 0, () => {
    if (ctx.fs) (ctx.fs as { closeAll: () => void }).closeAll()
    return ''
  })
  reg('ALLOPEN', 0, 0, () => {
    if (ctx.fs) {
      const names = (ctx.fs as { allOpen: () => string[] }).allOpen()
      return new LogoList(names)
    }
    return new LogoList([])
  })

  reg('SAVE', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) {
      const procs = Environment.allProcs()
      const text = procs.map((p) => p.text).join('\n')
      ;(ctx.fs as { write: (n: string, c: string) => void }).write(name, text)
    }
    return ''
  })

  reg('LOAD', 1, 1, (args) => {
    const name = toLogoString(args[0])
    if (ctx.fs) {
      const text = (ctx.fs as { read: (n: string) => string }).read(name)
      if (text) {
        const ast = parse(tokenize(text), ev)
        ev.runProgram(ast, ctx.env)
      }
    }
    return ''
  })

  reg('SETREAD', 1, 1, () => '')
  reg('SETWRITE', 1, 1, () => '')
  reg('EOFP', 0, 0, () => true)
  reg('SETPREFIX', 1, 1, () => '')
  reg('PREFIX', 0, 0, () => '')
  reg('READPOS', 0, 0, () => 0)
  reg('SETREADPOS', 1, 1, () => '')
  reg('SETWRITEPOS', 1, 1, () => '')
  reg('WRITEPOS', 0, 0, () => 0)
}

/** Render a value for PRINT (lists without brackets, words as-is). */
function renderForPrint(v: LogoValue): string {
  if (isList(v)) return v.items.map(renderForPrint).join(' ')
  if (isWord(v)) return v
  return toLogoString(v)
}

/** Render a value for SHOW (lists with brackets, words quoted). */
function renderForShow(v: LogoValue): string {
  if (isWord(v) && v !== '') return `"${v}`
  return toLogoString(v)
}
