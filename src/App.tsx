import { useRef, useState, useCallback, useEffect } from 'react'
import { Interpreter } from './interpreter/interpreter'
import type { LogoError } from './interpreter/errors'
import { Turtle, type TurtleState } from './turtle/Turtle'
import { VirtualFS } from './filesystem/VirtualFS'
import { Editor } from './components/Editor'
import { Blocks, type BlocksHandle } from './components/Blocks'
import type { EditorHandle } from './components/Editor'
import { TurtleCanvas } from './components/TurtleCanvas'
import { REPL } from './components/REPL'
import { Toolbar } from './components/Toolbar'
import { HelpPanel } from './components/HelpPanel'
import { StatusBar } from './components/StatusBar'
import './styles/global.css'
import type { Example } from './examples/catalog'

export default function App() {
  const [output, setOutput] = useState('')
  const [turtleState, setTurtleState] = useState<TurtleState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showBlocks, setShowBlocks] = useState(false)

  const interpreterRef = useRef<Interpreter | null>(null)
  const turtleRef = useRef<Turtle | null>(null)
  const fsRef = useRef<VirtualFS | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const blocksRef = useRef<BlocksHandle | null>(null)
  const executingEditor = useRef(false)

  // Initialize the filesystem once on mount (hydrate from IndexedDB).
  useEffect(() => {
    const fs = new VirtualFS()
    fsRef.current = fs
    fs.initialize()
  }, [])

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    // Same canvas re-reported (e.g. a real window resize): just resize in place.
    if (turtleRef.current && canvasRef.current === canvas) {
      turtleRef.current.setSize(canvas.width, canvas.height)
      return
    }
    canvasRef.current = canvas
    const t = new Turtle(canvas, {
      onStateChange: (state) => setTurtleState({ ...state }),
    })
    turtleRef.current = t

    const interp = new Interpreter({
      turtle: t,
      fs: fsRef.current ?? undefined,
      onOutput: (text) => setOutput((prev) => prev + text),
      onError: (error) => {
        const message = error.message || String(error)
        setOutput((prev) => prev + `${message}\n`)
        const location = (error as LogoError).location
        if (executingEditor.current) editorRef.current?.showError(message, location)
      },
    })
    interpreterRef.current = interp
    setTurtleState(t.getState())
  }, [])

  const runCode = useCallback(() => {
    setOutput('')
    editorRef.current?.clearErrors()
    try {
      if (showBlocks && !blocksRef.current) throw new Error('Blocks workspace is not ready')
      const code = showBlocks ? blocksRef.current!.getCode() : editorRef.current?.getValue() ?? ''
      executingEditor.current = !showBlocks
      interpreterRef.current?.run(code)
    } catch (error) {
      setOutput(`${error instanceof Error ? error.message : String(error)}\n`)
    } finally {
      executingEditor.current = false
    }
  }, [showBlocks])

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

  const loadExample = useCallback((example: Example) => {
    const current = editorRef.current?.getValue() ?? ''
    if (current.trim() && current !== example.source && !window.confirm(`Replace the current text program with ${example.title}? Save a copy first if you want to keep it.`)) return
    editorRef.current?.setValue(example.source)
    editorRef.current?.clearErrors()
    setShowBlocks(false)
    setOutput(`Loaded ${example.title}. Press Run to draw it.\n`)
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
      <Toolbar onRun={runCode} onStop={stop} onClear={clearScreen} onSave={onSave} onLoad={onLoad} onHelp={onHelp} onExample={loadExample} />
      <button onClick={() => setShowBlocks(value => !value)}>{showBlocks ? 'Text editor' : 'Blocks editor'}</button>

      <div className="main">
        <div className="editor-panel">
          <div style={{ height: '100%', display: showBlocks ? 'none' : 'block' }}><Editor ref={editorRef} onRun={runCode} /></div>
          {showBlocks && <Blocks ref={blocksRef} onRun={runCode} />}
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
