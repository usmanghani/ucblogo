import { handleAssistant } from '../server/assistant.ts'
export default { fetch(request: Request) { return handleAssistant(request) } }
