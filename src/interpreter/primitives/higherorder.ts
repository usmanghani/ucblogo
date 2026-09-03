/**
 * Higher-order primitives: MAP, FILTER, REDUCE, APPLY, CASCADE, etc.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import { truthy } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoList, isList, isWord, isNumber } from '../types'
import { badInput } from '../errors'
import { Environment } from '../environment'
import { tokenize } from '../lexer'

/** Register all higher-order primitives. */
export function registerHigherOrder(ev: Evaluator, ctx: EvalContext): void {
  const reg = (name: string, minArgs: number, maxArgs: number, fn: (a: LogoValue[]) => LogoValue) => {
    ev.registerPrimitive({ name, minArgs, maxArgs, fn: (args) => fn(args) })
  }

  // MAP template data
  reg('MAP', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('MAP', data)
    return new LogoList(data.items.map((item) => applyTemplate(ev, ctx, template, [item])))
  })

  reg('MAPSE', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('MAPSE', data)
    const out: LogoValue[] = []
    for (const item of data.items) {
      const result = applyTemplate(ev, ctx, template, [item])
      if (isList(result)) out.push(...result.items)
      else out.push(result)
    }
    return new LogoList(out)
  })

  reg('FILTER', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('FILTER', data)
    return new LogoList(data.items.filter((item) => truthy(applyTemplate(ev, ctx, template, [item]))))
  })

  reg('FIND', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('FIND', data)
    for (const item of data.items) {
      if (truthy(applyTemplate(ev, ctx, template, [item]))) return item
    }
    return ''
  })

  reg('REDUCE', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data) || data.items.length === 0) throw badInput('REDUCE', data)
    let acc = data.items[0]
    for (let i = 1; i < data.items.length; i++) {
      acc = applyTemplate(ev, ctx, template, [acc, data.items[i]])
    }
    return acc
  })

  reg('APPLY', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('APPLY', data)
    return applyTemplate(ev, ctx, template, data.items)
  })

  reg('INVOKE', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('INVOKE', data)
    return applyTemplate(ev, ctx, template, data.items)
  })

  reg('FOREACH', 2, 2, (args) => {
    // FOREACH data template (UCBLogo / Terrapin order).
    const data = isList(args[0]) ? args[0] : new LogoList(isWord(args[0]) ? args[0].split('') : [args[0]])
    const template = args[1]
    for (const item of data.items) {
      applyTemplate(ev, ctx, template, [item])
    }
    return ''
  })

  reg('CASCADE', 3, 3, (args) => {
    const template = args[0]
    const count = args[1]
    const start = args[2]
    if (!isNumber(count)) throw badInput('CASCADE', count)
    let value = start
    for (let i = 0; i < Math.trunc(count); i++) {
      value = applyTemplate(ev, ctx, template, [value, i + 1])
    }
    return value
  })

  reg('CASCADE2', 4, 4, (args) => {
    const template = args[0]
    const count = args[1]
    const start1 = args[2]
    const start2 = args[3]
    if (!isNumber(count)) throw badInput('CASCADE2', count)
    let v1 = start1
    let v2 = start2
    for (let i = 0; i < Math.trunc(count); i++) {
      const result = applyTemplate(ev, ctx, template, [v1, v2, i + 1])
      if (isList(result) && result.items.length >= 2) {
        v1 = result.items[0]
        v2 = result.items[1]
      }
    }
    return v1
  })

  reg('CROSSMAP', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('CROSSMAP', data)
    const out: LogoValue[] = []
    for (let i = 0; i < data.items.length; i++) {
      for (let j = 0; j < data.items.length; j++) {
        out.push(applyTemplate(ev, ctx, template, [data.items[i], data.items[j]]))
      }
    }
    return new LogoList(out)
  })

  reg('TRANSFER', 2, 2, (args) => {
    const template = args[0]
    const data = args[1]
    if (!isList(data)) throw badInput('TRANSFER', data)
    return new LogoList(data.items.map((item) => applyTemplate(ev, ctx, template, [item])))
  })

  // TEXT / DEFINE / DEF / COPYDEF
  reg('TEXT', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const proc = Environment.getProc(name)
    if (!proc) throw badInput('TEXT', args[0])
    return new LogoList([
      new LogoList([name, ...proc.params.map((p) => ':' + p)]),
      ...(ev.parseProcBody(proc)).map((node: any) => new LogoList([nodeToString(node)])),
    ])
  })

  reg('DEFINE', 2, 2, (args) => {
    const name = String(args[0]).toUpperCase()
    const def = args[1]
    if (!isList(def) || def.items.length === 0) throw badInput('DEFINE', args[1])
    const header = def.items[0]
    if (!isList(header)) throw badInput('DEFINE', args[1])
    const params = header.items.slice(1).map((p) => String(p).replace(/^:/, ''))
    const body = def.items.slice(1).map((item) => String(item))
    const text = body.join(' ')
    const bodyToks = tokenize(text)
    Environment.setProc(name, { name, params, bodyTokens: bodyToks, isMacro: false, text })
    return ''
  })

  reg('DEF', 2, 2, (args) => {
    // DEF is an alias for DEFINE.
    const name = String(args[0]).toUpperCase()
    const def = args[1]
    if (!isList(def) || def.items.length === 0) throw badInput('DEF', args[1])
    const header = def.items[0]
    if (!isList(header)) throw badInput('DEF', args[1])
    const params = header.items.slice(1).map((p) => String(p).replace(/^:/, ''))
    const body = def.items.slice(1).map((item) => String(item))
    const text = body.join(' ')
    const bodyToks = tokenize(text)
    Environment.setProc(name, { name, params, bodyTokens: bodyToks, isMacro: false, text })
    return ''
  })

  reg('COPYDEF', 2, 2, (args) => {
    const newName = String(args[0]).toUpperCase()
    const oldName = String(args[1]).toUpperCase()
    const proc = Environment.getProc(oldName)
    if (proc) {
      Environment.setProc(newName, { ...proc, name: newName })
    } else if (ev.hasPrimitive(oldName)) {
      const prim = ev.getPrimitive(oldName)!

      ev.registerPrimitive({
        name: newName,
        minArgs: prim.minArgs,
        maxArgs: prim.maxArgs,
        fn: prim.fn,
        isSpecial: prim.isSpecial,
      })
    }
    return ''
  })

  reg('MACROP', 1, 1, (args) => {
    const proc = Environment.getProc(String(args[0]).toUpperCase())
    return proc ? proc.isMacro : false
  })

  reg('MACROEXPAND', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    const proc = Environment.getProc(name)
    if (!proc || !proc.isMacro) return args[0]
    const newEnv = new Environment(ctx.env)
    const result = ev.evalSequence(ev.parseProcBody(proc), newEnv)
    return result
  })

  reg('DEFINEDP', 1, 1, (args) => {
    const name = String(args[0]).toUpperCase()
    return Environment.hasProc(name) || ev.hasPrimitive(name)
  })
}

/** Apply a template (a Logo procedure name or [list of instructions]) to args. */
function applyTemplate(ev: Evaluator, ctx: EvalContext, template: LogoValue, args: LogoValue[]): LogoValue {
  if (isWord(template)) {
    const name = template.toUpperCase()
    // Call the procedure with the given args.
    const prim = ev.getPrimitive(name)
    if (prim) {
      return prim.fn(args, ctx)
    }
    const proc = Environment.getProc(name)
    if (proc) {
      const newEnv = new Environment(ctx.env)
      for (let i = 0; i < proc.params.length; i++) {
        newEnv.set(proc.params[i].toUpperCase(), args[i] ?? '')
      }
      return ev.evalSequence(ev.parseProcBody(proc), newEnv)
    }
    throw badInput('MAP', template)
  }
  if (isList(template)) {
    // Template is a list of instructions; evaluate them with the args bound.
    const newEnv = new Environment(ctx.env)
    // Bind ? and ?1, ?2, ... to the args.
    if (args.length > 0) newEnv.set('?', args[0])
    for (let i = 0; i < args.length; i++) {
      newEnv.set(`?${i + 1}`, args[i])
    }
    return ev.evalTemplateWith(template.items, newEnv, args)
  }
  throw badInput('MAP', template)
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
