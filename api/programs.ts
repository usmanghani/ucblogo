import type { IncomingMessage, ServerResponse } from 'node:http'
import { handlePrograms } from '../server/api.js'
import { serve } from '../server/node.js'
import { checkTeacherQuota } from '../agent/lib/quota.js'

export default function programs(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return serve(handlePrograms, req, res, { throttle: checkTeacherQuota })
}
