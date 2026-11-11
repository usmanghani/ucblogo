import { DELETE, GET, POST, PUT, defineChannel } from 'eve/channels'
import { handleAccount, handlePrograms, handleProgress } from '../../server/api.ts'
import { checkTeacherQuota } from '../lib/quota'

// Accounts, saved programs and lesson progress. These routes have nothing to do with the
// model; they live in the agent service because it is the project's one server.
// vercel.ts sends /api/* here. The handlers and their rules are in server/api.ts.
const account = (request: Request) => handleAccount(request, { throttle: checkTeacherQuota })

export default defineChannel({
  routes: [
    GET('/api/account', account),
    POST('/api/account', account),
    GET('/api/programs', handlePrograms),
    POST('/api/programs', handlePrograms),
    PUT('/api/programs', handlePrograms),
    DELETE('/api/programs', handlePrograms),
    GET('/api/progress', handleProgress),
    PUT('/api/progress', handleProgress),
  ],
})
