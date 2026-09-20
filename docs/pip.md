# Pip, the Logo assistant

Pip is a collapsible side panel for writing Logo from prompts, explaining the current program, and iterating on drawings. Ask “draw a rocket ship” or “make it blue.” The agent reads the text editor, writes a complete program, runs it, feeds diagnostics back to the model, and continues for up to eight model steps. Tool cards show each action and its result. Replies stream as they arrive.

## Configure

Set `OPENROUTER_API_KEY` in Vercel project Settings → Environment Variables for Preview and Production, then redeploy. The key stays in the function environment. Never use a `VITE_` prefix or commit a key. For local development, copy `.env.example` to `.env.local`, set the value, and run `npm run dev`. The Vite development and preview servers expose the same `/api/assistant` handler.

The server always requests `openrouter/free`, including tools in each request. It never falls back to a paid model. Free model availability, response speed, and quality vary. Quota/rate errors are reported so the user can retry. A missing key returns a clear 503 configuration error.

This remains a public assistant with explicit provider-sharing consent. Same-origin checks are required but are not authentication. Vercel Firewall enforces shared quotas before any model request. Use a dedicated OpenRouter key with a spending limit; do not reuse a personal key with unrelated permissions.

### Configure shared quotas before deploying

Create two `@vercel/firewall` SDK rate-limit rules in the project's Firewall configuration:

| Rate limit ID | Suggested limit | Bucket supplied by server |
| --- | --- | --- |
| `pip-assistant-ip` | 60 requests / 60 seconds | Vercel's trusted client IP |
| `pip-assistant-global` | 300 requests / 60 seconds | `all-users` |

Each agent turn can use up to eight requests. Start by observing rule matches in log mode, validate enforcement in Preview, then enable rate limiting in Production after reviewing legitimate traffic. Missing rules, firewall errors, or an unexpected server environment fail closed with 503. Exhausted quotas return 429 with Retry-After. The rules must apply to Preview and Production, including automation requests; do not add broad firewall bypasses for CI. Enable Vercel system environment variables and the automation bypass environment required by the SDK for protected previews.

The API runs in `iad1` because Vercel's shared counters are per-region. Do not enable additional function regions without adjusting the total quota design. Only loopback local development is exempt from quota calls. Process-local counters are deliberately not used: they reset on cold starts and cannot enforce a shared budget.

## Workspace behavior

- The agent edits the text program, switching out of Blocks when it writes. It does not edit the block graph.
- Each run uses a fresh interpreter and turtle in a dedicated Web Worker with an OffscreenCanvas. It has no virtual files or hardware access. The worker is terminated after three seconds or when Stop is clicked. Successful runs transfer drawing pixels and turtle state to the visible canvas without executing generated source on the UI thread.
- A run reports output, errors, and turtle state. Pip does not receive an image or claim visual inspection. REPL definitions/variables are separate from the isolated run.
- Edits made during inference are checked before replacement or execution. Changes made during execution prevent stale drawings from being applied.
- Undo edits restores the pre-turn source only if it has not subsequently changed. It does not restore drawing pixels. Monaco also retains its normal edit history. Checkpoints are kept for the current page session and are not restored on refresh.
- Completed chats are saved to this tab’s sessionStorage. New chat clears the conversation; Clear saved session in the editor clears the program independently. Reload never automatically resumes an agent or executes a program.
- Each page load requires an explicit checkbox opt-in before any model request. The server also rejects requests without consent. Prompts, current source, and tool results are sent to OpenRouter and its selected free provider. No key is sent to the browser.
- Interrupted streams never execute partially assembled tool calls. Completed edits remain available after stop/error. Follow-ups include the interruption and reread the current editor.

## Tests

`npm test` covers agent sequencing, error repair, stream fragmentation, UTF-8, cancellation, step bounds, edit conflicts, request validation, server-only key handling, and no paid fallback. `npm run test:e2e` adds prompt-to-drawing, follow-up, chat persistence, undo, cancellation, infinite-loop termination, and mobile/error states. E2E tests mock model responses but use the real editor, agent loop, worker, interpreter, and canvas. The same suite runs against Vercel previews through existing CI. A separate required `npm run test:live` makes one small synthetic request to the deployed endpoint and verifies actual model output through the complete SSE stream. It does not evaluate model quality. Missing server credentials or quota configuration blocks CI.

References:
- https://openrouter.ai/docs/guides/routing/routers/free-router
- https://openrouter.ai/docs/guides/features/tool-calling
- https://vercel.com/docs/functions/runtimes/node-js
