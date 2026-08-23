import { useRef, useEffect } from 'react'

/** Fixed logical canvas size; the wrapper scrolls to reach off-viewport drawing. */
export const CANVAS_WIDTH = 2000
export const CANVAS_HEIGHT = 1500

interface TurtleCanvasProps {
  onReady: (canvas: HTMLCanvasElement) => void
}

export function TurtleCanvas({ onReady }: TurtleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || initRef.current) return

    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // Start scrolled to the center, where the turtle homes.
    const wrapper = canvas.parentElement
    if (wrapper) {
      wrapper.scrollLeft = (wrapper.scrollWidth - wrapper.clientWidth) / 2
      wrapper.scrollTop = (wrapper.scrollHeight - wrapper.clientHeight) / 2
    }

    onReady(canvas)
    initRef.current = true
  }, [onReady])

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="turtle-canvas" />
    </div>
  )
}
