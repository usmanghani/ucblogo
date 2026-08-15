/**
 * Property-list primitives.
 */

import type { Evaluator } from '../evaluator'
import type { LogoValue } from '../types'
import { LogoList } from '../types'
import { Environment } from '../environment'

/** Register property-list primitives. */
export function registerProperties(ev: Evaluator): void {
  ev.registerPrimitive({
    name: 'GPROP',
    minArgs: 2,
    maxArgs: 2,
    fn: (args: LogoValue[]) => Environment.getProp(String(args[0]), String(args[1])),
  })

  ev.registerPrimitive({
    name: 'PPROP',
    minArgs: 3,
    maxArgs: 3,
    fn: (args: LogoValue[]) => {
      Environment.setProp(String(args[0]), String(args[1]), args[2])
      return ''
    },
  })

  ev.registerPrimitive({
    name: 'REMPROP',
    minArgs: 2,
    maxArgs: 2,
    fn: (args: LogoValue[]) => {
      Environment.remProp(String(args[0]), String(args[1]))
      return ''
    },
  })

  ev.registerPrimitive({
    name: 'PLISTS',
    minArgs: 0,
    maxArgs: 0,
    fn: () => new LogoList(Environment.allProps()),
  })

  ev.registerPrimitive({
    name: 'PROPS',
    minArgs: 1,
    maxArgs: 1,
    fn: (args: LogoValue[]) => {
      const name = String(args[0])
      const props = Environment.propNames(name)
      return new LogoList(props.flatMap((p) => [p, Environment.getProp(name, p)]))
    },
  })
}
