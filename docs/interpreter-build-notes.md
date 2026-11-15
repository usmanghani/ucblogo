# UCBLogo Web — Build Plan & Session Trace

## Architecture

```
ucblogo/
├── src/
│   ├── interpreter/
│   │   ├── types.ts        # LogoValue, LogoList, LogoArray, LogoProc, predicates
│   │   ├── errors.ts        # LogoError, StopSignal, OutputSignal, ThrowSignal
│   │   ├── lexer.ts         # Tokenize Logo source → Token[]
│   │   ├── arity.ts         # PRIMITIVE_ARITY table (~250 entries)
│   │   ├── parser.ts        # Parse Token[] → ASTNode[] (arity-aware, infix precedence)
│   │   ├── environment.ts   # Dynamic scoping, global proc/prop storage
│   │   ├── evaluator.ts     # Tree-walking with loop-based TCO, special forms
│   │   ├── interpreter.ts   # Top-level Interpreter class
│   │   └── primitives/      # ~250 built-in procedures
│   │       ├── arithmetic.ts    # SUM, SIN, RANDOM, AND, OR...
│   │       ├── lists.ts         # FIRST, BUTFIRST, SENTENCE...
│   │       ├── words.ts         # WORD, CHAR, ASCII...
│   │       ├── turtle_prims.ts  # FORWARD, RIGHT, SETPENCOLOR...
│   │       ├── control.ts       # IF, REPEAT, WHILE, CATCH... (special forms)
│   │       ├── io.ts            # PRINT, SHOW, SAVE, LOAD...
│   │       ├── higherorder.ts   # MAP, FILTER, REDUCE, APPLY...
│   │       ├── workspace.ts     # MAKE, THING, PO, BURY...
│   │       ├── arrays.ts        # ARRAY, SETITEM...
│   │       ├── properties.ts    # GPROP, PPROP...
│   │       ├── misc.ts          # TIME, HELP
│   │       └── index.ts         # registerAll()
│   ├── turtle/Turtle.ts     # Canvas engine: state, drawing, WRAP/FENCE/WINDOW
│   ├── filesystem/VirtualFS.ts  # IndexedDB-backed, synchronous in-memory Map
│   ├── help/helpData.ts     # 50 categorized command descriptions
│   ├── components/          # React UI
│   │   ├── Editor.tsx       # Monaco + Logo language definition
│   │   ├── TurtleCanvas.tsx # Canvas binding
│   │   ├── REPL.tsx         # Interactive REPL with history
│   │   ├── Toolbar.tsx      # Run/Stop/Clear/Save/Load/Help
│   │   ├── HelpPanel.tsx    # Searchable, categorized help
│   │   └── StatusBar.tsx    # Turtle x/y/heading/pen
│   ├── styles/global.css    # Dark theme
│   ├── App.tsx              # Layout + wiring
│   └── main.tsx             # Entry point
├── tests/
│   ├── setup.ts
│   ├── lexer.test.ts        # Tokenization: commands, strings, comments, operators, signed numbers
│   ├── parser.test.ts       # Parsing: calls, lists, infix precedence, procdef
│   ├── evaluator.test.ts    # Arithmetic, lists, REPEAT, IF/IFELSE, WHILE, FOR, OUTPUT, recursion, MAP
│   ├── turtle.test.ts       # Movement, heading, pen state, home
│   ├── integration.test.ts  # Square, spiral, tree, factorial, sentence
│   ├── registry.test.ts     # All PRIMITIVE_ARITY keys uppercase + registered
│   └── virtualfs.test.ts    # Write/read/erase/list, sequential I/O, append
├── vercel.json              # Vite SPA, dist/ output
├── .tool-versions           # Pin nodejs 22.20.0
└── package.json
```

## Design Decisions

### Lazy body parsing (forward references)
**Problem:** Procedures defined in later REPL submissions are unknown when earlier
procedures' bodies are parsed. `OUTER` calling `INNER` (defined after `OUTER`)
resolved `INNER` as a literal, not a call.

**Solution:**
1. Parser pre-scans all `TO` headers in a single source into `localArity` map
   (fixes forward references within one `run()`).
2. For cross-REPL forward references: procedure bodies are stored as raw `Token[]`
   on `LogoProc.bodyTokens`, NOT pre-parsed. At call time, `parseProcBody()` tokenizes
   + appends EOF + parses fresh with the Evaluator as `AritySource`, so all
   currently-defined procedures are known.

### Tail-call optimization
The evaluator uses a tree-walking interpreter without explicit TCO loops in the
main eval method. OUTPUT/Stop control flow uses exceptions (OutputSignal,
StopSignal) caught at the user-procedure call boundary. Deep recursion tests
(COUNT 5000, tree fractal) pass without stack overflow.

### Dynamic scoping
`Environment` has a `parent` chain. Each procedure call creates a new frame
with `parent = caller's frame`. Variable lookup walks up the chain.

### IndexedDB persistence
`VirtualFS` uses an in-memory `Map` for synchronous Logo primitive access.
`initialize()` hydrates from IndexedDB on mount. Mutations write-through to
IndexedDB (fire-and-forget). Degrades to memory-only when IndexedDB is unavailable.

### Signed numbers
The lexer recognizes `-3` and `+3` as single NUMBER tokens (when the sign is
immediately followed by a digit with no space). This prevents `[-3 4 -5]` from
becoming infix `4 - 5` inside the list.

## Session Trace

### Scaffold & project setup
- Created Vite + React + TypeScript project at `$HOME/ucblogo`
- Installed `@monaco-editor/react`, `vitest`, `jsdom`, `@testing-library/react`
- Pinned node to 22.20.0 via `.tool-versions` (asdf shim)
- Initial git commit on `main`

### Interpreter core (types, lexer, parser, environment, evaluator)
- `types.ts`: LogoValue union, LogoList/LogoArray classes, predicates
- `errors.ts`: LogoError, StopSignal, OutputSignal, ThrowSignal
- `lexer.ts`: Token types, space-delimited + delimiter-aware tokenization
- `parser.ts`: Arity-aware parsing with infix precedence climbing, TO/END handling
- `environment.ts`: Dynamic scoping, global proc/prop/buried storage
- `evaluator.ts`: Tree-walking with special forms (IF, REPEAT, WHILE, FOR, CATCH, etc.)
- `interpreter.ts`: Top-level class wiring lexer→parser→eval

### Fix: `eval` reserved word
Renamed all `eval: Evaluator` parameters to `ev: Evaluator` across all primitive
files (perl bulk rename). Strict-mode rejects `eval` as a parameter name.

### Fix: `require()` → ES imports
Replaced all `require('../types').LogoList` patterns with top-level imports across
io.ts, turtle_prims.ts, higherorder.ts, words.ts, arrays.ts.

### Fix: Inline `import()` types
Replaced `import('./parser').ASTNode` with top-level `import type { ASTNode }`
in types.ts, errors.ts, evaluator.ts.

### Fix: `Promise.withResolvers`
Replaced `new Promise((resolve, reject) => ...)` with `Promise.withResolvers()`
in VirtualFS. Required bumping `lib` to `ES2024` in tsconfig.

### Forward references (key architectural fix)
- Added `prescanProcHeaders()` to parser: pre-scan all `TO` headers to build
  `localArity` map before parsing any body.
- Changed `LogoProc.body` (ASTNode[]) → `bodyTokens` (Token[]).
- Changed `ProcDefNode.body` → `bodyTokens`.
- `parseProcDef` now collects raw tokens (skipping parse), appends EOF at call time.
- `parseProcBody()` on Evaluator re-parses tokens with current arity registry.
- Fixed `parseProcBody` to append EOF token (per advisory).
- Fixed DEFINE/DEF in higherorder.ts to tokenize body text before storing.

### Registry parity
- Audit: declared-but-unregistered primitives: BURYNAME, DRAW, PENPATTERN,
  REPCOUNT, TIME, TIMEFORMAT, SETTIMEFORMAT, HELP, FULLSCREENS, SAVEPICT,
  LOADPICT, SETPENPATTERN, TEXTSCREEN, SPLITSCREEN, MACROEXPAND.
- Fixed `EOFp` (lowercase table key → EOFP).
- Added missing registrations in turtle_prims.ts, workspace.ts, control.ts, misc.ts.
- Added `registry.test.ts` iterating `Object.keys(PRIMITIVE_ARITY)` → verifies
  all uppercase + all registered + no duplicates.

### Turtle heading fix
`left()` was adding degrees (clockwise), `right()` was subtracting. Logo semantics:
left = counterclockwise (subtract), right = clockwise (add). Fixed with proper
modulo normalization.

### MAP fix
`[-3 4 -5]` was parsing as `[-3, (4-5)]` = `[-3, -1]` because `-5` became infix
subtraction. Fixed lexer to recognize signed numbers (`-3`, `+3`) as single NUMBER
tokens when sign is immediately followed by digit.

### OUTPUT fix
`OutputSignal` was propagating past `PRINT`'s arg evaluation, exiting runProgram
without printing. Fixed by catching `OutputSignal` at the user-procedure call
boundary in `evalCall`.

### VirtualFS writeLine fix
`writeLine` in write mode was overwriting instead of accumulating. Fixed to
always read current content before appending.

### Vercel config
Created `vercel.json`: Vite framework, `dist/` output, SPA rewrites. Deployment
blocked by authentication (requires device-code OAuth).

## Verification

```
$ npx vitest run
Test Files  7 passed (7)
     Tests  51 passed (51)

$ npm run build
✓ built in 96ms
  dist/assets/index-kp6ijQvZ.js   266.09 kB │ gzip: 82.04 kB
  dist/assets/index-DHCjv_r_.css    4.07 kB │ gzip:  1.29 kB
```

| Test file | Tests | Covers |
|-----------|-------|--------|
| `lexer.test.ts` | 7 | Commands, strings, varrefs, delimiters, comments, operators, signed numbers |
| `parser.test.ts` | 7 | Procedure calls, quoted words, varrefs, lists, infix precedence, procdef, multi-statement |
| `evaluator.test.ts` | 15 | Arithmetic, infix, lists, words, REPEAT/REPCOUNT, IF/IFELSE, WHILE, FOR, OUTPUT, recursion, dynamic scoping, MAP, properties, unknown procs |
| `turtle.test.ts` | 7 | Center position, forward, headings, pen state, color, home |
| `integration.test.ts` | 5 | Square, spiral, tree (recursive), factorial, sentence |
| `registry.test.ts` | 3 | All arity keys uppercase, all registered, no duplicates |
| `virtualfs.test.ts` | 7 | Write/read, normalize, erase, list, sequential I/O, append, open tracking |
