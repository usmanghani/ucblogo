import { connectGitHubCredentials } from '@vercel/connect/eve'
import { defaultGitHubAuth, githubChannel } from 'eve/channels/github'
import { reviewCommand, shouldReviewComment, shouldReviewPullRequest } from '../lib/triggers.ts'

// The GitHub App is created and held by Vercel Connect, which also verifies its webhooks,
// so this project stores no private key and no webhook secret. Setting GITHUB_APP_ID switches
// to a GitHub App you manage yourself (with GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET).
const CONNECT_CLIENT = process.env.REVIEW_CONNECT_CLIENT || 'github/ucblogo-reviewer'

export default githubChannel({
  ...(process.env.GITHUB_APP_ID ? {} : { credentials: connectGitHubCredentials(CONNECT_CLIENT) }),

  // A pull request is reviewed once, when a trusted author opens it or marks it ready.
  onPullRequest: (ctx, pullRequest) =>
    shouldReviewPullRequest(pullRequest.action, pullRequest.raw)
      ? {
          auth: defaultGitHubAuth(ctx),
          title: `Review ${ctx.repository.fullName}#${pullRequest.pullRequestNumber}`,
          context: ['A pull request is ready for review. Review it now, following your instructions.'],
        }
      : null,

  // "/review" in a pull request comment asks for another pass. Text after the command narrows it.
  onComment: (ctx, comment) => {
    const onPullRequest = ctx.conversation.pullRequestNumber !== null
    if (!shouldReviewComment(comment.body, comment.raw, onPullRequest)) return null
    const focus = reviewCommand(comment.body)
    return {
      auth: defaultGitHubAuth(ctx),
      title: `Review ${ctx.repository.fullName}#${ctx.conversation.pullRequestNumber}`,
      context: [
        focus
          ? `A maintainer asked for a review with "/review ${focus}". Review the pull request as it stands now, paying particular attention to what they asked.`
          : 'A maintainer asked for a review with "/review". Review the pull request as it stands now.',
      ],
    }
  },
})
