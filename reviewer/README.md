# Code reviewer

An [eve](https://eve.dev) agent that reviews pull requests on this repository. It is separate from the teaching app: its own package, its own Vercel project (`ucblogo-reviewer`), and nothing in the app imports it.

## What it does

- **When a pull request is opened**, marked ready for review, or reopened, it reviews it.
- **When someone comments `/review`** on a pull request, it reviews it again. Words after the command narrow the review, for example `/review the database changes`.
- Only the repository's owner, members and collaborators can start a review. Draft pull requests, bots and outside contributors are ignored.

The review is posted as one comment on the pull request: a verdict, findings in order of severity with file and line, and what was checked.

## How it works

| Part | Where | What |
| --- | --- | --- |
| Trigger | `agent/channels/github.ts` | eve's GitHub channel receives the GitHub App's webhooks at `/eve/v1/github`. The rules for who and what starts a review are in `agent/lib/triggers.ts`. |
| Model | `agent/agent.ts` | `deepseek/deepseek-v4.1-flash-1017` through Vercel AI Gateway. The deployment signs in with its own OIDC identity, so there is no model key. Set `REVIEW_MODEL` to change it. |
| Workspace | `agent/sandbox.ts` | Each review runs in its own Vercel Sandbox with the pull request checked out, so the reviewer reads and searches the whole codebase and can run the project's checks. |
| Guidance | `agent/instructions.md` | What to look for and the shape of the review. |

The GitHub App is created and held by Vercel Connect (connector `github/ucblogo-reviewer`), which verifies the webhooks and issues short-lived tokens. The project stores no private key or webhook secret, and the token never enters the sandbox.

## Working on it

```bash
cd reviewer
npm install
npm test          # the trigger rules
npm run typecheck
npm run build
```

## Deploying

The Vercel project `ucblogo-reviewer` is connected to this repository with `reviewer/` as its root folder. A push to `main` that changes anything in `reviewer/` redeploys it to production; pushes that leave the folder alone are skipped. Other branches get a preview deployment, which GitHub does not send webhooks to.

Do **not** run `eve deploy` or `vercel deploy` from this folder without naming the project. The Vercel CLI links by Git repository, so it picks the teaching app's project and replaces the live site.
