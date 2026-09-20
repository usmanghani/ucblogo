# Tests and release checks

Every branch push and pull request runs CI. Local unit tests, lint, build, and Chromium browser tests run immediately while a separate job waits up to 15 minutes for Vercel to deploy the exact commit being tested. PR jobs check out the PR head SHA; push jobs check out the pushed SHA. Failed/canceled/inactive deployments and missing deployments fail CI. The candidate must serve `/deployment.json` with the exact commit SHA. This also allows testing a built production candidate while promotion is held by Deployment Checks. The newest deployment wins; an older successful deployment cannot mask a failed redeploy.

Once Vercel is ready, `Vercel deployment tests` runs the browser suite against its immutable URL, then makes a real synthetic assistant request. The live smoke verifies JSON/API routing, server credentials, quota configuration, SSE model output, and the completion marker. Missing configuration, truncated streams, and provider errors fail; transient 429/502/504 responses get at most three attempts. Model requests stay on `openrouter/free`.

`CI gate` requires every job to succeed. There is no successful skip for missing previews. Deployment status events no longer start duplicate CI runs; the push/PR workflow waits directly. Forks never receive the protection bypass secret. A protected fork deployment needs a maintainer-approved deployment/test path; its inaccessible preview cannot pass silently.

## Required external settings

These are account settings, not properties that a workflow file can enforce:

1. GitHub: protect `main`, require PRs, require branches to be current, and require both `CI gate` and `Vercel deployment tests` from GitHub Actions. Disable force pushes and deletions; enforce protection for administrators. The second check has a distinct name from the previous optional preview job.
2. Vercel: add `CI gate` and `Vercel deployment tests` as required GitHub Deployment Checks before promotion. Keep preview deployments automatic. A successful build is not sufficient to release. Verify the checks are for the production commit, not a previous PR commit.
3. Vercel/GitHub: configure Protection Bypass for Automation. Store the bypass in the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`; expose it to Vercel functions as required by the rate-limit SDK. Browser credentials are scoped to the deployment origin and traces are disabled when credentials are present.
4. Configure the two assistant quota rules and Preview/Production server key described in `docs/pip.md`. Until configured, the live check intentionally blocks release.

The wait job accepts a candidate in progress only once its URL serves the expected build commit marker. It does not depend on the success status emitted after production promotion, avoiding a cycle between promotion and tests.

An administrator can apply the reviewed GitHub protection payload with:

```sh
gh api --method PUT repos/usmanghani/ucblogo/branches/main/protection --input .github/main-protection.json
```

## Local commands

```
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app npm run test:e2e
PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app npm run test:live
```

Node 24 is used by CI and declared in package.json for Vercel. `npm ci` installs the committed lockfile. Monaco and its workers are copied from the pinned dependency before builds and served from versioned local URLs. Browser coverage blocks public editor CDNs to prove the editor works without them.

## Browser session

The text editor saves edits in sessionStorage, scoped to this browser tab. Refresh restores source, including an intentionally empty editor, without executing it. `Clear saved session` asks before clearing. These drafts do not replace saving/exporting programs.

## References

- https://vercel.com/docs/deployment-checks
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
