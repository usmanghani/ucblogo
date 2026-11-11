import { useEffect, useRef } from 'react'

/** Fixed logical canvas size. The turtle's home is the middle. */
export const CANVAS_WIDTH = 2000
export const CANVAS_HEIGHT = 1500
/** The square around home that should always be visible without scrolling. */
const STAGE = 640

interface TurtleCanvasProps {
  onReady: (canvas: HTMLCanvasElement) => void
}

export function TurtleCanvas({ onReady }: TurtleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = canvas?.parentElement
    if (!canvas || !wrapper) return
    if (!initRef.current) {
      canvas.width = CANVAS_WIDTH
      canvas.height = CANVAS_HEIGHT
      onReady(canvas)
      initRef.current = true
    }
    // Shrink the picture in a small pane so the stage around home always fits, and keep
    // home centered. The rest of the canvas stays reachable by scrolling.
    const fit = () => {
      if (!wrapper.clientWidth || !wrapper.clientHeight) return
      const scale = Math.min(1, wrapper.clientWidth / STAGE, wrapper.clientHeight / STAGE)
      canvas.style.width = `${CANVAS_WIDTH * scale}px`
      canvas.style.height = `${CANVAS_HEIGHT * scale}px`
      wrapper.scrollLeft = (wrapper.scrollWidth - wrapper.clientWidth) / 2
      wrapper.scrollTop = (wrapper.scrollHeight - wrapper.clientHeight) / 2
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [onReady])

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="turtle-canvas" aria-label="Turtle drawing" />
    </div>
  )
}
