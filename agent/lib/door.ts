import { ForbiddenError, UnauthenticatedError, type AuthFn } from 'eve/channels/auth'
import { checkTeacherQuota, type QuotaCheck } from './quota'

/**
 * Logo Teacher is a public classroom with no accounts, so the agent accepts anonymous
 * callers. Two checks stand in front of that: the request must come from this site's own
 * pages, and requests that start model work are metered by Vercel Firewall.
 */
export const classroomDoor = (quota: QuotaCheck = checkTeacherQuota): AuthFn<Request> => async request => {
  const refuse = () => new ForbiddenError({ message: 'Logo Teacher only answers its own pages.' })
  // Browsers state where a request came from, and a page on another site cannot forge it.
  // It also survives the proxies between the page and the agent, which rewrite Host.
  const site = request.headers.get('sec-fetch-site')
  if (site) {
    if (site !== 'same-origin') throw refuse()
  } else {
    // Older browsers and scripts: fall back to comparing Origin with the host that was asked for.
    const origin = request.headers.get('origin')
    const hosts = [request.headers.get('x-forwarded-host'), request.headers.get('host')]
    let originHost = ''
    try { originHost = origin ? new URL(origin).host : '' } catch { /* refused below */ }
    if (origin ? !hosts.includes(originHost) : request.method !== 'GET') throw refuse()
  }
  if (request.method === 'POST') {
    const refusal = await quota(request)
    if (refusal === 'limited') throw new UnauthenticatedError({ code: 'rate_limited', message: 'Pip is helping a lot of students right now. Wait a minute, then try again.' })
    if (refusal === 'unavailable') throw new UnauthenticatedError({ code: 'quota_unavailable', message: 'Pip is not set up yet: the usage limits for this site are missing. See docs/pip.md.' })
  }
  return null
}
