import { useRef, useEffect } from 'react'

interface TurtleCanvasProps {
  onReady: (canvas: HTMLCanvasElement) => void
}

export function TurtleCanvas({ onReady }: TurtleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      onReady(canvas)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [onReady])

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="turtle-canvas" />
    </div>
  )
}
