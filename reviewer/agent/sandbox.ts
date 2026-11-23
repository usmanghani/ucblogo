import { defineSandbox } from 'eve/sandbox'
import { VercelSandbox } from 'eve/sandbox/vercel'

// Every review runs in its own Vercel Sandbox: a separate microVM that holds the checked-out
// repository and is where the reviewer's shell and file tools run. The GitHub channel checks
// the pull request out into it before the first model call. The GitHub token never enters the
// VM; it is added to git requests at the sandbox firewall.
export const environment = VercelSandbox.environment()

export default defineSandbox(() => environment.open({ resources: { vcpus: 2 }, timeout: 45 * 60 * 1000 }))
