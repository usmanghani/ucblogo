/**
 * Control-flow primitive registration.
 *
 * Evaluation of these forms is implemented in Evaluator.evalSpecial; this file
 * only marks them as special so their arguments remain unevaluated there.
 */

import type { Evaluator } from '../evaluator'
import type { EvalContext } from '../evaluator'

/** Register all special forms. */
export function registerControl(ev: Evaluator, ctx: EvalContext): void {
  const special = (name: string, minArgs: number, maxArgs: number) => {
    ev.registerPrimitive({
      name,
      minArgs,
      maxArgs,
      isSpecial: true,
      fn: () => '',
    })
  }

  special('IF', 2, 2)
  special('IFELSE', 3, 3)
  special('TEST', 1, 1)
  special('IFTRUE', 1, 1)
  special('IFFALSE', 1, 1)
  special('REPEAT', 2, 2)
  special('WHILE', 2, 2)
  special('UNTIL', 2, 2)
  special('DO.WHILE', 2, 2)
  special('DO.UNTIL', 2, 2)
  special('FOR', 4, 5)
  special('DOTIMES', 3, 3)
  special('FOREVER', 1, 1)
  special('CATCH', 2, 2)
  special('THROW', 1, 2)
  special('STOP', 0, 0)
  special('OUTPUT', 1, 1)
  special('OP', 1, 1)
  special('RUN', 1, 1)
  special('CASE', 2, 2)
  special('GO', 1, 1)
  special('RETURN', 1, 1)
  special('BREAK', 0, 0)
  special('CONTINUE', 0, 0)

  // REPCOUNT is not a special form; it reads a variable set by REPEAT.
  ev.registerPrimitive({ name: 'REPCOUNT', minArgs: 0, maxArgs: 0, fn: () => ctx.env.get('REPCOUNT') })
}
