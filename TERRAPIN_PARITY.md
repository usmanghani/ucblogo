# Terrapin compatibility work

Full parity is not established. Do not interpret passing tests as full program coverage.

## Verification

- `tests/fixtures/terrapin-logolib`: 47 original programs and source-page metadata.
- `tests/terrapin-library.test.ts`: top-level parsing only.
- `tests/terrapin-audit.test.ts`: all procedure bodies and bounded startup. Expected failures are recorded in `tests/fixtures/terrapin-audit.json`. This is a regression baseline, not proof of correctness. Programs that only define procedures have not executed their entry points.
- `tests/terrapin-execution.test.ts`: original FACTORING, FACTORIAL.FOR, FACTORIAL.WHILE and FACTORIAL.RECUR with numerical assertions and local-variable isolation.
- `tests/blocks.test.ts`: generated loop execution, incomplete-input errors, serialization round trip.
- `tests/bluebot.test.ts`: logical command compilation; no BLE packet or device validation.

Run `npx vitest run` and `npm run build`. Refresh the audit deliberately with `UPDATE_TERRAPIN_AUDIT=1 npx vitest run tests/terrapin-audit.test.ts`, then review every changed failure.

## Remaining acceptance criteria

1. Execution coverage: explicit entry point, deterministic inputs, output/drawing/event assertions for each of the 47 programs. Supply fixtures for user interactions and external assets.
2. Language: finish quotation/list semantics, numeric tokenization, optional arities, dynamic scope throughout higher-order operations, GO/LABEL, procedure-local STOP, and remaining aliases. Eliminate all body-parse failures.
3. Runtime features: replace unsupported-command errors with real stamping, fonts, color names, audio, timer/animation scheduling, multiple turtles, property integration, controls and input events. Make Stop interrupt execution without freezing the browser. Existing unrelated no-op primitives also require audit.
4. Diagnostics: real-browser Monaco tests, precise nested/dynamic-code source maps, and source attribution for REPL and block execution. REPL/block errors must not navigate unrelated editor text.
5. Blocks: richer expressions, conditions, procedures, source mapping, interaction tests, accessibility and responsive layout validation. Current implementation is an initial Blockly workspace, not a full LogoBlocks replica.
6. Robots: verified device UUIDs and wire encodings, connection lifecycle, queueing, response parsing, disconnect/error recovery, and simulated transport tests for each supported robot. Physical hardware validation is explicitly excluded from the requested scope. The Blue-Bot compiler currently produces logical instructions only and is not connected to interpreter primitives.

## References

- https://resources.terrapinlogo.com/logolib/
- https://logoblocks.terrapinlogo.com/
- https://resources.terrapinlogo.com/logo/commands/bluebot.html
- https://resources.terrapinlogo.com/logo6/manual/inobot.html
- https://docs.blockly.com/guides/get-started/save-and-load/
