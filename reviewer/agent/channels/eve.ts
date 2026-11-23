import { eveChannel } from 'eve/channels/eve'
import { localDev, vercelOidc } from 'eve/channels/auth'

// The reviewer is reached from GitHub. Its own HTTP API stays closed to the public:
// only this Vercel team's deployments and tools, and localhost in development, may use it.
export default eveChannel({ auth: [vercelOidc(), localDev()] })
