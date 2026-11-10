import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { MAX_PROGRAM_CHARS, checkProgram, type ProgramCheck } from '../../src/logo/check'

export default defineTool({
  description: "Replace the program in the student's code pane with a complete Logo program and run it, so they watch it draw. Returns what the run did: printed output, errors with line numbers, the turtle's final position, and the size of the drawing. If it reports errors, fix the program and call this again.",
  inputSchema: z.object({
    code: z.string().min(1).max(MAX_PROGRAM_CHARS).describe('The complete Logo source. No Markdown fences.'),
  }),
  label: { start: () => 'Writing a program', complete: (_input, output) => ((output as ProgramCheck).ok ? 'Wrote and ran a program' : 'The program has a problem') },
  execute({ code }) {
    return checkProgram(code)
  },
})
