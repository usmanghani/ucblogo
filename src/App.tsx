import { useRef, useState, useCallback, useEffect } from 'react'
import { Interpreter } from './interpreter/interpreter'
import { Turtle, type TurtleState } from './turtle/Turtle'
import { VirtualFS } from './filesystem/VirtualFS'
import { Editor } from './components/Editor'
import { TurtleCanvas } from './components/TurtleCanvas'
import { REPL } from './components/REPL'
import { Toolbar } from './components/Toolbar'
import { HelpPanel } from './components/HelpPanel'
import { StatusBar } from './components/StatusBar'
import './styles/global.css'

export default function App() {
  const [output, setOutput] = useState('')
  const [turtleState, setTurtleState] = useState<TurtleState | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const interpreterRef = useRef<Interpreter | null>(null)
  const turtleRef = useRef<Turtle | null>(null)
  const fsRef = useRef<VirtualFS | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<{ getValue: () => string; setValue: (v: string) => void } | null>(null)

  // Initialize the filesystem once on mount (hydrate from IndexedDB).
  useEffect(() => {
    const fs = new VirtualFS()
    fsRef.current = fs
    fs.initialize()
  }, [])

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas
    const t = new Turtle(canvas, {
      onStateChange: (state) => setTurtleState({ ...state }),
    })
    turtleRef.current = t

    const interp = new Interpreter({
      turtle: t,
      fs: fsRef.current ?? undefined,
      onOutput: (text) => setOutput((prev) => prev + text),
    })
    interpreterRef.current = interp
    setTurtleState(t.getState())
  }, [])

  const runCode = useCallback(() => {
    const code = editorRef.current?.getValue() ?? ''
    setOutput('')
    const interp = interpreterRef.current
    if (interp) interp.run(code)
  }, [])

  const stop = useCallback(() => {
    setOutput((prev) => prev + '\n[Stopped]\n')
  }, [])

  const clearScreen = useCallback(() => {
    turtleRef.current?.clearScreen()
    setOutput('')
  }, [])

  const onHelp = useCallback(() => setShowHelp((v) => !v), [])

  const onSave = useCallback(() => {
    const name = prompt('File name:')
    if (name && interpreterRef.current && fsRef.current) {
      const code = editorRef.current?.getValue() ?? ''
      fsRef.current.write(name, code)
      setOutput((prev) => prev + `Saved to ${name}\n`)
    }
  }, [])

  const onLoad = useCallback(() => {
    const name = prompt('File name:')
    if (name && fsRef.current) {
      const code = fsRef.current.read(name)
      if (code) {
        editorRef.current?.setValue(code)
        setOutput((prev) => prev + `Loaded ${name}\n`)
      } else {
        setOutput((prev) => prev + `File ${name} not found\n`)
      }
    }
  }, [])

  const replSubmit = useCallback((line: string) => {
    const interp = interpreterRef.current
    if (interp) {
      const result = interp.evalLine(line)
      if (result) setOutput((prev) => prev + result + '\n')
    }
  }, [])

  return (
    <div className="app">
      <Toolbar onRun={runCode} onStop={stop} onClear={clearScreen} onSave={onSave} onLoad={onLoad} onHelp={onHelp} />

      <div className="main">
        <div className="editor-panel">
          <Editor ref={editorRef} onRun={runCode} />
        </div>
        <div className="canvas-panel">
          <TurtleCanvas onReady={onCanvasReady} />
        </div>
      </div>

      <div className="bottom">
        <REPL onSubmit={replSubmit} />
        <div className="output" role="log">
          {output.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <StatusBar state={turtleState} />

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  )
}
