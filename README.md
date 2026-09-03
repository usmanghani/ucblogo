# UCBLogo Web

A Logo programming environment that runs in the browser and on the command
line: a Logo interpreter compatible with UCBLogo and Terrapin Logo programs, a
turtle-graphics canvas, a Monaco code editor, and a **Logo Blocks** editor in
the spirit of [Terrapin's Logo Blocks](https://logoblocks.terrapinlogo.com/)
where programs are built by snapping blocks together and emitted as Logo.

## Running

```sh
npm install
npm run dev          # web app on http://localhost:5173
npm test             # vitest: interpreter, blocks, CLI and the Terrapin library suite
npm run build        # web app to dist/, CLI to dist/cli/ucblogo.mjs
```

## Blocks editor

The **Blocks** tab shows a Blockly workspace with Logo-flavoured categories:
Turtle, Pen, Control, Logic, Math, Words & Lists, Text output, Variables and
Procedures. Every change regenerates Logo source, which is what actually runs
when you press **Run**; switch to the **Code** tab to see or edit it. Blocks
are remembered in the browser between visits.

Standard Blockly blocks map onto Logo idioms: `repeat` → `REPEAT n [...]`,
`if / else if / else` → nested `IFELSE`, `count with i` → `FOR [I from to step]
[...]`, procedures → `TO name :param ... END`, variables → `MAKE "name value`
and `:name`.

## The `.lgb` file format

**Export** in Blocks mode writes a `.lgb` file. It is plain Logo — the
generated program — followed by the block layout stored in comment lines:

```logo
REPEAT 4 [
  FORWARD 100
  RIGHT 90
]

; @logoblocks v1
; {"blocks":{"languageVersion":0,"blocks":[...]}}
; @end
```

Because the trailer is comments, any Logo interpreter runs a `.lgb` file
unchanged (including the CLI below), while **Import** in the web app restores
the blocks from it. Files without a trailer (`.lgo`) open in the Code tab.

## Command line

```sh
npm run build:cli
node dist/cli/ucblogo.mjs program.lgo        # or program.lgb
node dist/cli/ucblogo.mjs -e "REPEAT 36 [FD 100 BK 100 RT 10]"
node dist/cli/ucblogo.mjs                    # REPL; :help lists commands
```

The CLI prints the program's text output, then draws the turtle canvas in the
terminal using 24-bit colour half-block characters (`--ascii` switches to
monochrome braille dots). Errors report the line and procedure and echo the
offending source line. Useful options: `--width/--height` (canvas size in
turtle steps, default 800x600), `--cols/--rows` (terminal cells), `--ppm FILE`
(save the drawing as an image), `--no-graphics`, `--steps N`.

## Errors

A failing program shows a red banner above the text output with the message,
the procedure it happened in and a **line N** button; the editor marks the
line (gutter dot, highlight, hover message) and moves the cursor to it. Errors
in block programs point at the generated Logo, which the banner opens in the
Code tab.

## Logo dialect

The interpreter follows UCBLogo and accepts the Terrapin/Apple Logo forms used
by the [Terrapin Logo Program Library](https://resources.terrapinlogo.com/logolib/);
all 48 library programs load and run (`tests/logolib.test.ts`). Highlights:

- `IF cond THEN ... ELSE ...`, `IF cond [then] [else]`, and `IF cond instr`
- `TO name :a [:opt default] [:rest] 2` headers, bare parameter names
- `"|barred words|`, `` `backquoted` `` words, `~` / `\` line continuation
- `FOR [i 1 10 2] [...]` and `FOR "i 1 10 [...]`
- `GO "label` / `LABEL "label`, `TOPLEVEL`, `CATCH "ERROR`, tail calls
- multiple turtles: `TELL`, `ASK`, `EACH`, `WHO`, `SETTURTLES`, `DECLARE`
- colours by number (UCBLogo palette), name (`SETPC "RED`), or `[r g b]`
- `STAMPOVAL`, `STAMPRECT`, `DOT`, `SETWIDTH`, `PX`/`PE`, `TT`, `PR`, `CT`,
  `LOCAL`/`LMAKE`, `PPROPS`, `ALIAS`, `WAIT`, `PLAY` (accepted, silent) …

`RANDOM n` outputs 1..n as in Terrapin Logo; `RANDOM0 n` gives 0..n-1.

## Project layout

```
src/interpreter/      lexer, parser, evaluator, primitives (incl. terrapin.ts)
src/turtle/           canvas turtle engine (multi-turtle), colours
src/blocks/           Blockly block definitions, Logo generator, .lgb format
src/cli/              software rasterizer, terminal renderer, CLI entry
src/components/       React UI (Editor, BlocksPanel, Toolbar, ...)
tests/                vitest suites; tests/fixtures/logolib holds the library
```
