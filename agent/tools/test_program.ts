import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { MAX_PROGRAM_CHARS, checkProgram, type ProgramCheck } from '../../src/logo/check'

export default defineTool({
  description: "Run Logo code privately, without changing the student's code pane or drawing. Use it to check a snippet before showing it, or to learn what a program does. Returns printed output, errors with line numbers, the turtle's final position, and the size of the drawing.",
  inputSchema: z.object({
    code: z.string().min(1).max(MAX_PROGRAM_CHARS).describe('Logo source to run. No Markdown fences.'),
  }),
  label: { start: () => 'Checking some code', complete: (_input, output) => ((output as ProgramCheck).ok ? 'Checked some code' : 'Found a problem') },
  execute({ code }) {
    return checkProgram(code)
  },
})
