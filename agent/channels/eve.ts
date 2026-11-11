import { localDev, none } from 'eve/channels/auth'
import { defaultEveAuth, eveChannel } from 'eve/channels/eve'
import { classroomDoor } from '../lib/door'
import { describePage } from '../lib/page-context'

export default eveChannel({
  // The door refuses other sites and over-quota traffic; whoever it lets by is anonymous.
  auth: [classroomDoor(), localDev(), none()],
  // Students may attach a picture of a drawing. The page shrinks it first; this is the backstop.
  uploadPolicy: { maxBytes: 3 * 1024 * 1024, allowedMediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  onMessage(ctx) {
    // Replace what the browser sent with a checked, bounded description of the page.
    return { auth: defaultEveAuth(ctx), clientContext: describePage(ctx.eve.clientContext) }
  },
})
