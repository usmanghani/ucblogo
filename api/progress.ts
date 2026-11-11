import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleProgress } from '../server/api.js'
import { serve } from '../server/node.js'
import { checkTeacherQuota } from '../agent/lib/quota.js'

export default function progress(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return serve(handleProgress, req, res, { throttle: checkTeacherQuota })
}
