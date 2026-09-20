import type { TurtleState } from '../turtle/Turtle'
export interface RunResult { output: string; errors: string[]; state?: TurtleState; image?: ImageBitmap }
export function runLogo(code: string, width: number, height: number, signal: AbortSignal): Promise<RunResult> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./logo.worker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); reject(new DOMException('Turn stopped', 'AbortError')) }
    const timer = setTimeout(() => { cleanup(); resolve({ output: '', errors: ['Execution stopped after 3 seconds. Simplify the program or fix an infinite loop.'] }) }, 3000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = event => { cleanup(); resolve(event.data) }
    worker.onerror = () => { cleanup(); resolve({ output: '', errors: ['The isolated Logo runner could not start.'] }) }
    worker.postMessage({ code, width, height })
  })
}
