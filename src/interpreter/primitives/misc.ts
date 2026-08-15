/**
 * Miscellaneous primitives: TIME, TIMEFORMAT, SETTIMEFORMAT, HELP.
 */

import type { Evaluator, EvalContext } from '../evaluator'
import type { LogoValue } from '../types'
import { toLogoString } from '../types'
import { findHelp } from '../../help/helpData'

/** Register miscellaneous primitives. */
export function registerMisc(ev: Evaluator, ctx: EvalContext): void {
  ev.registerPrimitive({
    name: 'TIME',
    minArgs: 0,
    maxArgs: 0,
    fn: () => Date.now(),
  })

  ev.registerPrimitive({
    name: 'TIMEFORMAT',
    minArgs: 1,
    maxArgs: 1,
    fn: (args) => {
      const ms = args[0]
      if (typeof ms !== 'number') return ''
      const d = new Date(ms)
      return d.toLocaleString()
    },
  })

  ev.registerPrimitive({
    name: 'SETTIMEFORMAT',
    minArgs: 1,
    maxArgs: 1,
    fn: () => '',
  })

  ev.registerPrimitive({
    name: 'HELP',
    minArgs: 1,
    maxArgs: 1,
    fn: (args: LogoValue[]) => {
      const query = toLogoString(args[0])
      const results = findHelp(query)
      if (results.length === 0) {
        ctx.output(`No help found for ${query}\n`)
        return ''
      }
      for (const entry of results) {
        ctx.output(`${entry.name}: ${entry.description}\n`)
        if (entry.example) ctx.output(`  Example: ${entry.example}\n`)
      }
      return ''
    },
  })
}
