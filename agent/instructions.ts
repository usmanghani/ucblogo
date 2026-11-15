import { defineInstructions } from 'eve/instructions'
import { teacherPrompt } from './lib/prompt'

export default defineInstructions({ content: teacherPrompt })
