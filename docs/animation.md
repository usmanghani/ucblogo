# Rocket launch

Choose **Examples → Rocket launch (animated)** and press **Run**. The three-second countdown is followed by flickering exhaust and accelerating liftoff. **Stop** freezes the current drawing. Run again to replay. The original **Rocket ship** example and `examples/rocket.lgo` are unchanged.

The animation is Logo source in `examples/rocket-launch.lgo`. Change the `HEIGHT`, `SPEED`, frame count, or `WAIT 4` in its launch loop to experiment.

`WAIT` uses sixtieths of a second: `WAIT 60` pauses for one second, and `WAIT 4` requests approximately 15 frames per second. Rendering work and browser scheduling can lengthen the interval. Inputs must be finite numbers from 0 through 3600 ticks.

Editor Run cooperatively executes procedures and loops, allowing the browser to repaint during WAIT. Stop, Clear, another Run, and loading an example cancel the active run. Long programs also yield periodically and retain the existing execution-step limit.

The synchronous interpreter API, command-line REPL, and Pip's isolated verification runner still reject WAIT explicitly. Use the editor's Run action for animations. WAIT inside callbacks executed by synchronous higher-order primitives is also unsupported; use ordinary procedures and REPEAT loops.
