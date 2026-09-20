import { Interpreter } from '../interpreter/interpreter'
import { Turtle } from '../turtle/Turtle'

self.onmessage = (event: MessageEvent<{ code: string; width: number; height: number }>) => {
  try {
    const canvas = new OffscreenCanvas(event.data.width, event.data.height)
    const turtle = new Turtle(canvas)
    let output = ''
    const errors: string[] = []
    const interpreter = new Interpreter({ turtle,
      onOutput: text => { output = (output + text).slice(0, 12000) },
      onError: error => { errors.push(error.message) },
    })
    interpreter.run(event.data.code)
    const state = turtle.getState()
    turtle.hideTurtle() // Transfer strokes only; the main turtle draws its own marker.
    const image = canvas.transferToImageBitmap()
    postMessage({ output, errors, state, image }, { transfer: [image] })
  } catch (error) { postMessage({ errors: [error instanceof Error ? error.message : String(error)] }) }
}
