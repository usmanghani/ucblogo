import { localDev, none } from 'eve/channels/auth'
import { defaultEveAuth, eveChannel } from 'eve/channels/eve'
import { classroomDoor } from '../lib/door'
import { describePage } from '../lib/page-context'

export default eveChannel({
  // The door refuses other sites and over-quota traffic; whoever it lets by is anonymous.
  auth: [classroomDoor(), localDev(), none()],
  onMessage(ctx) {
    // Replace what the browser sent with a checked, bounded description of the page.
    return { auth: defaultEveAuth(ctx), clientContext: describePage(ctx.eve.clientContext) }
  },
})
