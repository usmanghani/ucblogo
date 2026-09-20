# Tests and merge checks

Every branch push and pull request runs `CI`:

- `Unit tests, lint, and build`: all Vitest tests, lint, and a production build.
- `Browser tests`: Chromium runs against a local production build.
- `Vercel preview tests`: the same browser suite runs against a successful Vercel deployment for the exact commit. No deployment means this job is explicitly skipped. A deployed but inaccessible or broken preview fails; it is not silently skipped.
- `CI gate`: succeeds only if the mandatory jobs pass and the preview job either passes or is legitimately skipped.

Successful deployment status events rerun CI, so a preview that finishes after the initial checks gets browser coverage. The workflow must exist on the default branch for deployment events. Vercel must publish GitHub deployment records. For protected previews, create a Vercel Protection Bypass for Automation secret and store it as the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Credentials are sent only to the deployment origin; traces are disabled when credentials are used. Fork PRs do not receive the secret. Without access, CI fails early with setup instructions.

Reports, traces, and failure screenshots are uploaded as workflow artifacts. No automatic merging is configured.

## Required repository setting

A workflow alone does not prevent merging. In repository Settings → Rules → Rulesets, require `CI gate` from GitHub Actions on all PR target branches, require branches to be up to date, and restrict bypasses. This setting needs repository administration access and must be verified independently of the workflow file.

## Local commands

```
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app npm run test:e2e
```

The 37 language/geometry regressions cover supported behavior; they do not assert complete Terrapin parity. Known library compatibility gaps remain tracked by the parity PRs, including command names inside literal lists on main.

This branch retains its existing editor and blocks persistence.
