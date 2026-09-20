export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
export interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}
export const MAX_PROGRAM = 30000
export const tools = [
  { type: 'function', function: { name: 'read_program', description: 'Read the current text editor program and workspace context.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'write_program', description: 'Replace the text editor with a complete executable Logo program. Includes an undo checkpoint. Does not run it.', parameters: { type: 'object', properties: { code: { type: 'string', description: 'Complete Logo source, without Markdown fences.' } }, required: ['code'], additionalProperties: false } } },
  { type: 'function', function: { name: 'run_program', description: 'Run the current text program in an isolated worker, draw its result, and return output and errors. Starts from a fresh turtle and interpreter. No filesystem or device access.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
] as const
