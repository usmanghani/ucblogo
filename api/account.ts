import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAccount } from '../server/api.js'
import { serve } from '../server/node.js'
import { checkTeacherQuota } from '../agent/lib/quota.js'

export default function account(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return serve(handleAccount, req, res, { throttle: checkTeacherQuota })
}
