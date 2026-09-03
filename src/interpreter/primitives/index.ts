/** Register every built-in primitive with the evaluator. */

import type { Evaluator, EvalContext } from '../evaluator'
import { registerArithmetic } from './arithmetic'
import { registerLists } from './lists'
import { registerWords } from './words'
import { registerTurtle } from './turtle_prims'
import { registerControl } from './control'
import { registerIO } from './io'
import { registerHigherOrder } from './higherorder'
import { registerWorkspace } from './workspace'
import { registerArrays } from './arrays'
import { registerProperties } from './properties'
import { registerMisc } from './misc'
import { registerTerrapin } from './terrapin'

export function registerAll(ev: Evaluator, ctx: EvalContext): void {
  registerArithmetic(ev, ctx)
  registerLists(ev)
  registerWords(ev)
  registerTurtle(ev, ctx)
  registerControl(ev, ctx)
  registerIO(ev, ctx)
  registerHigherOrder(ev, ctx)
  registerWorkspace(ev, ctx)
  registerArrays(ev)
  registerProperties(ev)
  registerMisc(ev, ctx)
  registerTerrapin(ev, ctx)
}
