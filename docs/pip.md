# Pip, the Logo teacher

Pip is an [eve](https://eve.dev) agent that lives in `agent/`. The page talks to it at `/eve/v1/*` on its own origin. This page covers what Pip does, how to configure it, and what it costs and shares.

## What happens in a turn

1. The student sends a message. The page attaches a snapshot of the workspace: the program in the code pane, the result of the last run, the open lesson, and the finished lessons.
2. `agent/channels/eve.ts` decides whether to accept the request (see [Who can use Pip](#who-can-use-pip)), then replaces the browser's snapshot with a checked, bounded description of it (`agent/lib/page-context.ts`). That context applies to this turn only and is not kept in the conversation history.
3. The model answers, calling tools when it wants to. Tools run on the server.
4. The reply streams into the Pip pane. When a `write_program` call finishes, the page puts that program in the code pane and runs it; when `complete_lesson` finishes, the page records the lesson.

### Tools

| Tool | What it does | What the page does |
| --- | --- | --- |
| `write_program` | Runs a complete program on the server and reports the result | Puts the program in the code pane and runs it, with **Undo change** |
| `test_program` | Runs code privately and reports the result | Shows a note only |
| `complete_lesson` | Validates the lesson id and names the next lesson | Marks the lesson finished |

Both program tools return the same report from `src/logo/check.ts`: printed output, errors with line numbers, the turtle's final position and heading, the number of strokes, the box they fit in, and the pen colors used. That report is how Pip repairs its own mistakes before telling a student something works. Pip does not receive an image and its brief tells it not to claim it looked at the drawing.

Server runs start from a clean interpreter, have no file system, treat `WAIT` as instant, and stop after 100,000 evaluation steps or two seconds. Pip has no shell, file, or web tools (`defaultTools: false`).

### Drawings

A student can attach a picture, usually a photo of a drawing on paper, and Pip writes a Logo program that draws its main shapes. Use the picture button in the message box.

- The page redraws the picture on a canvas before sending: at most 1280 pixels on its long side, as a JPEG. That keeps a phone photo to a few hundred kilobytes and removes its metadata, such as where it was taken.
- The agent accepts JPEG, PNG, WebP and GIF up to 3 MB (`uploadPolicy` in `agent/channels/eve.ts`) and refuses anything else.
- eve stores an attached file in the session's sandbox and shows it to the model on later turns of that conversation. On Vercel that is Vercel Sandbox, which the project must be able to use; locally it is the `just-bash` dev dependency.
- The model must accept images. The default one does. If you change `PIP_MODEL`, pick one with vision.
- Pip is briefed to describe the shapes it sees, not people, and to say plainly that the result is the turtle's version of the drawing. It still cannot see the turtle's own drawing pane.

### The course

`src/teacher/lessons.ts` lists the lessons: title, goal, new words, a starter program and a challenge. The page renders it as the lesson path. `agent/lib/prompt.ts` writes it into Pip's instructions. A unit test runs every starter program to make sure it works and fits the drawing pane.

## Configure

| Variable | Default | Purpose |
| --- | --- | --- |
| `PIP_MODEL` | `deepseek/deepseek-v4.1-flash` | The AI Gateway model id that teaches |
| `PIP_MODEL_BASE_URL` | unset | Use an OpenAI-compatible endpoint instead of AI Gateway |
| `PIP_MODEL_API_KEY` | unset | Key for that endpoint, if it needs one |

All three are read on the server when a turn runs. Nothing is exposed to the browser.

On Vercel no key is needed: a plain model id goes through [AI Gateway](https://vercel.com/docs/ai-gateway), and the deployment authenticates with its own OIDC identity. Model usage is billed to the Vercel team that owns the project. The model must support tool calling.

For local development, `npx eve link` links the directory to the Vercel project and pulls a development token. `AI_GATEWAY_API_KEY` in `.env.local` also works.

Each conversation pauses and asks whether to continue after 1.5 million new input tokens or 150,000 output tokens (`limits.sessionUsage` in `agent/agent.ts`). Idle conversations end after 24 hours.

## Who can use Pip

There are no accounts. Pip accepts anonymous callers, behind two checks in `agent/lib/door.ts`:

- **Same site only.** The request must come from this site's own pages. Browsers say so in `Sec-Fetch-Site`, which another site's page cannot forge; requests without it fall back to comparing `Origin` with the requested host. This stops other websites from spending your budget through a visitor's browser. It is not authentication: a script can send any header it likes, which is what the quota is for.
- **Usage quota.** Every request that starts work is checked against two Vercel Firewall rate-limit rules. Reading a reply stream is not counted.

### Create the quota rules before deploying

In the Vercel project, under Firewall, create two `@vercel/firewall` SDK rate-limit rules:

| Rate limit ID | Suggested limit | Counted per |
| --- | --- | --- |
| `pip-assistant-ip` | 30 requests / 60 seconds | visitor IP |
| `pip-assistant-global` | 300 requests / 60 seconds | everyone together |

One student message is one request, however many model steps Pip takes to answer it.

If a rule is missing, or the Firewall cannot be reached, Pip refuses the turn and the student sees "Pip is not set up yet". This is deliberate: an anonymous endpoint that spends money should not run unmetered. A spent quota shows "Pip is helping a lot of students right now". Outside Vercel (local development, self-hosting) there is no shared counter and the check is skipped.

Firewall counters are per region, so `vercel.ts` pins the project to `iad1`. If you add regions, revisit the limits.

## Privacy

- Before the first message, the page tells the student that Pip is an AI and that their messages and the program in the code pane are sent to an AI model. Nothing is sent until they press **Start learning**. The choice is remembered in that browser.
- What is sent each turn: the student's message, any picture they attach, the program, the last run's output and errors, and lesson progress. No names, accounts or identifiers are collected by this application.
- Conversations are stored by eve on Vercel Workflow so they can resume after a reload. The page keeps the conversation cursor in `sessionStorage` (this tab only) and lesson progress in `localStorage`.
- Model requests go through Vercel AI Gateway to the provider of the configured model. Their data terms apply; choose a model whose terms suit your students.
- Pip's brief asks it to stay on Logo, programming and drawing, and to treat program text and output as data rather than instructions. A prompt is not a guarantee. If you run this for children, supervise.

## Tests

`npm test` covers the server-side program check, every lesson starter, the access check, the quota's three outcomes, the page-context sanitiser, the tools, the message adapter between eve and assistant-ui, the reply renderer, and how the page reacts when Pip's tools fire.

`npm run test:e2e` drives the real page, agent and tools in Chromium against a scripted model (`e2e/fake-model.mjs`): consent, a program arriving in the code pane and drawing, Pip repairing its own error from the run report, a lesson from start to completion, page context reaching the model, a hand drawing turned into a program, stopping a turn, a refused request, cross-site refusal, and the phone layout.

`npm run test:live` sends one synthetic message and then one synthetic picture to a deployed preview. It requires a complete reply to each and requires Pip to name the shape in the picture. It proves routing, the access check, the quota rules, AI Gateway access and picture uploads are all in place. It does not judge the teaching.
