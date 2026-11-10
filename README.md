# Logo Teacher

Learn to program by drawing. **Pip**, a turtle who teaches Logo, sits beside your code and your drawing and shows you one idea at a time.

The page has three panes:

| Pane | What it is |
| --- | --- |
| **Pip** | The teacher. A conversation, an eight-lesson course, and progress that is remembered. |
| **Code** | Your Logo program, in an editor that highlights Logo and marks the line an error came from. |
| **Drawing** | What the turtle drew, what the program printed, and a command line for one-off commands. |

Pip can put a program in your code pane and run it while you watch, check code privately before showing it, and mark a lesson complete when you have done its challenge. You can also show Pip a photo of something you drew on paper, and Pip will write a Logo program that draws it. Every code block in Pip's replies has a **Try it** button. When a program you ran stops with an error, one click asks Pip what went wrong.

Pip is told what is in your code pane and how your last run went with every message, so you never have to paste code into the chat.

## How it is built

```
agent/                 Pip, an eve agent (https://eve.dev)
  agent.ts             model and limits
  instructions.ts      the teaching brief, built from the course
  tools/               write_program, test_program, complete_lesson
  channels/eve.ts      who may talk to Pip, and what page context reaches the model
  lib/                 access check, usage quota, page-context sanitiser, prompt
src/
  teacher/             the Pip pane: assistant-ui chat on an eve session, lessons, progress
  components/          code editor, turtle canvas, command line, Logo word reference
  interpreter/         the Logo language: lexer, parser, evaluator, primitives
  turtle/              turtle graphics
  logo/check.ts        run a program with no screen and report what it did
examples/              Logo programs offered in the Examples menu
e2e/                   browser tests, with a scripted stand-in for the language model
tests/                 unit tests
vercel.ts              deploys the page and the agent as two services of one Vercel project
```

Two things are worth knowing before changing anything:

- **The Logo engine runs in two places.** In the browser it draws on a canvas, animated. On the server, Pip's tools run the same engine through `src/logo/check.ts` with no canvas and no clock, to learn whether a program works before telling a student it does. Pip never sees the picture: it gets printed output, errors with line numbers, where the turtle ended, and the box the strokes fit in.
- **The course is one file.** `src/teacher/lessons.ts` feeds both the lesson path on the page and Pip's teaching brief. Add or edit a lesson there and both follow.

The chat is [assistant-ui](https://www.assistant-ui.com) primitives over eve's `useEveAgent` hook. The agent loop, streaming, session history and resuming after a reload are eve's; there is no hand-written model protocol in this repository.

## Run it

Node 24.

```bash
npm ci
```

```bash
npm run dev
```

`npm run dev` starts the page and Pip together; the Vite plugin from eve proxies `/eve/v1/*` to the agent. The page works without a model, but Pip needs one to answer. Either link the directory to your Vercel project so the agent can use AI Gateway:

```bash
npx eve link
```

or put `AI_GATEWAY_API_KEY`, or a `PIP_MODEL_BASE_URL` for any OpenAI-compatible endpoint, in `.env.local`. See `.env.example`.

## Test it

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run test:e2e
```

The browser tests run the real page, agent, tools and Logo engine. Only the language model is replaced, by the scripted one in `e2e/fake-model.mjs`, so they need no credentials and cost nothing.

## Deploy it

Push to a Git-connected Vercel project. `vercel.ts` builds the page with Vite and adds Pip as an eve service; Vercel Workflow keeps conversations durable, and AI Gateway serves the model using the deployment's own identity, so there is no provider key to set.

Before the first production deploy, read [docs/pip.md](docs/pip.md): Pip is a public, anonymous endpoint that spends money, and it refuses to answer until its two usage-limit rules exist in the project's Firewall.

## More

- [docs/pip.md](docs/pip.md): how Pip works, its configuration, limits and privacy
- [docs/ci.md](docs/ci.md): tests and release checks
- [docs/animation.md](docs/animation.md): `WAIT` and animated programs
- [docs/terrapin-parity.md](docs/terrapin-parity.md) and [docs/interpreter-build-notes.md](docs/interpreter-build-notes.md): notes on the interpreter
