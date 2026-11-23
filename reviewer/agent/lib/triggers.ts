/** Who may start a review. Everyone else's pull requests and comments are ignored. */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

type Json = Record<string, unknown>
const object = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {})

/** GitHub's own statement of how the author relates to the repository. */
export function isTrusted(association: unknown): boolean {
  return typeof association === 'string' && TRUSTED.has(association)
}

/**
 * The text after "/review" when a comment asks for a review, or null when it does not.
 * The command must start a line, so quoting or discussing "/review" mid-sentence does nothing.
 */
export function reviewCommand(body: string): string | null {
  for (const line of body.split(/\r?\n/)) {
    const match = /^\s*\/review(?:\s+(.*))?$/i.exec(line)
    if (match) return (match[1] ?? '').trim()
  }
  return null
}

/** Whether a pull_request webhook should start a review: a trusted author's PR becoming ready. Takes GitHub's pull request object. */
export function shouldReviewPullRequest(action: string, pullRequest: Json): boolean {
  if (action !== 'opened' && action !== 'ready_for_review' && action !== 'reopened') return false
  if (pullRequest.draft === true) return false
  if (object(pullRequest.user).type === 'Bot') return false
  return isTrusted(pullRequest.author_association)
}

/** Whether a comment should start a review: "/review" from a trusted person, on a pull request. Takes GitHub's comment object. */
export function shouldReviewComment(body: string, raw: Json, onPullRequest: boolean): boolean {
  if (!onPullRequest || reviewCommand(body) === null) return false
  if (object(raw.user).type === 'Bot') return false
  return isTrusted(raw.author_association)
}
