/**
 * Workspace primitives: MAKE, THING, ERASE, PO, BURY, CONTENTS, etc.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoList } from '../types'
import { Environment } from '../environment'

/** Register all workspace primitives. */
export function registerWorkspace(ev: Evaluator, ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  reg('MAKE', 2, 2, (args) => {
    const name = String(args[0]).toUpperCase()
    ctx.env.setGlobal(name, args[1])
    return ''
  })

  reg('NAME', 2, 2, (args) => {
    const name = String(args[1]).toUpperCase()
    ctx.env.setGlobal(name, args[0])
    return ''
  })

  reg('THING', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    return ctx.env.get(name)
  })

  reg('ERASE', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    ctx.env.erase(name)
    Environment.eraseProc(name)
    return ''
  })

  reg('BURY', 1, 1, (args) => {
    Environment.bury(String(args[0]))
    return ''
  })

  reg('BURYNAME', 1, 1, (args) => {
    Environment.bury(String(args[0]))
    return ''
  })

  reg('UNBURY', 1, 1, (args) => {
    Environment.unbury(String(args[0]))
    return ''
  })

  reg('BURIED', 0, 0, () => {
    return new LogoList(Environment.buriedNames())
  })

  reg('BURIEDP', 1, 1, (args) => {
    return Environment.isBuried(String(args[0]))
  })

  reg('BURYALL', 0, 0, () => {
    for (const p of Environment.allProcs()) Environment.bury(p.name)
    return ''
  })

  reg('UNBURYALL', 0, 0, () => {
    Environment.clearBuried()
    return ''
  })

  reg('CONTENTS', 0, 0, () => {
    const names = Environment.allProcs().map((p) => p.name)
    return new LogoList(names)
  })

  reg('PROCEDUREP', 1, 1, (args) => Environment.hasProc(String(args[0]).toUpperCase()))
  reg('PRIMITIVEP', 1, 1, (args) => ev.hasPrimitive(String(args[0]).toUpperCase()))

  reg('PO', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const proc = Environment.getProc(name)
    if (proc) {
      ctx.output(`TO ${name} ${proc.params.map((p) => ':' + p).join(' ')}\n`)
      ctx.output(`  ${(ev.parseProcBody(proc)).map((n: any) => nodeToString(n)).join(' ')}\n`)
      ctx.output('END\n')
    }
    return ''
  })

  reg('POPS', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const proc = Environment.getProc(name)
    if (proc) {
      ctx.output(`TO ${name} ${proc.params.map((p) => ':' + p).join(' ')}\n`)
      ctx.output(`  ${(ev.parseProcBody(proc)).map((n: any) => nodeToString(n)).join(' ')}\n`)
      ctx.output('END\n')
    }
    return ''
  })

  reg('POT', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const proc = Environment.getProc(name)
    if (proc) {
      ctx.output(`TO ${name} ${proc.params.map((p) => ':' + p).join(' ')}\n`)
    }
    return ''
  })

  reg('POTS', 0, 0, () => {
    for (const p of Environment.allProcs()) {
      ctx.output(`TO ${p.name} ${p.params.map((x) => ':' + x).join(' ')}\n`)
    }
    return ''
  })

  reg('ALLOWGETSET', 0, 0, () => '')
  reg('PLIST', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const props = Environment.propNames(name)
    return new LogoList(props.flatMap((p) => [p, Environment.getProp(name, p)]))
  })
}

function nodeToString(node: unknown): string {
  const n = node as { type: string; value?: unknown; name?: string }
  switch (n.type) {
    case 'literal':
      return String(n.value)
    case 'varref':
      return ':' + String(n.name)
    case 'call':
      return String(n.name)
    default:
      return String(n.value ?? n.name ?? '')
  }
}
