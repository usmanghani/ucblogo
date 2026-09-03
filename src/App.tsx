import { useRef, useState, useCallback, useEffect } from 'react'
import { Interpreter, formatError } from './interpreter/interpreter'
import { LogoError } from './interpreter/errors'
import { Turtle, type TurtleState } from './turtle/Turtle'
import { VirtualFS } from './filesystem/VirtualFS'
import { Editor, type EditorHandle } from './components/Editor'
import { BlocksPanel, type BlocksPanelHandle } from './components/BlocksPanel'
import { TurtleCanvas } from './components/TurtleCanvas'
import { REPL } from './components/REPL'
import { Toolbar, type EditorMode } from './components/Toolbar'
import { HelpPanel } from './components/HelpPanel'
import { StatusBar } from './components/StatusBar'
import { encodeLgb, decodeLgb } from './blocks/lgbFormat'
import './styles/global.css'

/** Safety net for runaway programs in the (single-threaded) browser. */
const BROWSER_STEP_LIMIT = 20_000_000
const MODE_KEY = 'ucblogo.editor.mode'

interface RunError {
  message: string
  line?: number
  col?: number
  procName?: string
}

function loadMode(): EditorMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'code' ? 'code' : 'blocks'
  } catch {
    return 'blocks'
  }
}

export default function App() {
  const [output, setOutput] = useState('')
  const [turtleState, setTurtleState] = useState<TurtleState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [runError, setRunError] = useState<RunError | null>(null)
  const [mode, setMode] = useState<EditorMode>(loadMode)

  const interpreterRef = useRef<Interpreter | null>(null)
  const turtleRef = useRef<Turtle | null>(null)
  const fsRef = useRef<VirtualFS | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const blocksRef = useRef<BlocksPanelHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /** Latest Logo emitted by the blocks workspace, and what was last pushed to the editor. */
  const blocksCodeRef = useRef('')
  const pushedCodeRef = useRef<string | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Initialize the filesystem once on mount (hydrate from IndexedDB).
  useEffect(() => {
    const fs = new VirtualFS()
    fsRef.current = fs
    fs.initialize()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // ignore
    }
    if (mode === 'blocks') blocksRef.current?.resize()
    // Entering Code mode shows the blocks' Logo, unless the blocks have not
    // changed since it was last shown (so hand edits are not clobbered).
    if (mode === 'code' && blocksCodeRef.current && pushedCodeRef.current !== blocksCodeRef.current) {
      pushedCodeRef.current = blocksCodeRef.current
      editorRef.current?.setValue(blocksCodeRef.current)
    }
  }, [mode])

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
      onClearText: () => setOutput(''),
      readLine: () => window.prompt('Logo is waiting for input:') ?? undefined,
    })
    interp.evaluator.maxSteps = BROWSER_STEP_LIMIT
    interpreterRef.current = interp
    setTurtleState(t.getState())
  }, [])

  /** Blocks changed: keep the code editor in sync with the generated Logo. */
  const onBlocksCode = useCallback((code: string) => {
    blocksCodeRef.current = code
    if (modeRef.current === 'blocks') {
      pushedCodeRef.current = code
      editorRef.current?.setValue(code)
    }
  }, [])

  /** The program to run: the editor text (which mirrors the blocks in Blocks mode). */
  const currentCode = useCallback((): string => {
    if (modeRef.current === 'blocks') return blocksRef.current?.getCode() ?? blocksCodeRef.current
    return editorRef.current?.getValue() ?? ''
  }, [])

  /** Report a LogoError: banner, output log, and editor marker at the failing line. */
  const reportError = useCallback((e: LogoError, fromEditor: boolean) => {
    const err: RunError = { message: e.message, line: e.line, col: e.col, procName: e.procName }
    setRunError(err)
    setOutput((prev) => prev + formatError(e) + '\n')
    if (fromEditor && e.line !== undefined) {
      editorRef.current?.showError({ message: e.message, line: e.line, col: e.col })
    }
  }, [])

  const runCode = useCallback(() => {
    const code = currentCode()
    setOutput('')
    setRunError(null)
    editorRef.current?.clearErrors()
    const interp = interpreterRef.current
    if (!interp) return
    try {
      interp.runOrThrow(code)
    } catch (e) {
      if (e instanceof LogoError) reportError(e, true)
      else {
        const msg = e instanceof Error ? e.message : String(e)
        setRunError({ message: `Internal error: ${msg}` })
        setOutput((prev) => prev + `Internal error: ${msg}\n`)
      }
    }
  }, [currentCode, reportError])

  const stop = useCallback(() => {
    interpreterRef.current?.requestStop()
    setOutput((prev) => prev + '\n[Stopped]\n')
  }, [])

  const clearScreen = useCallback(() => {
    turtleRef.current?.clearScreen()
    setOutput('')
    setRunError(null)
    editorRef.current?.clearErrors()
  }, [])

  const jumpToError = useCallback(() => {
    if (runError?.line === undefined) return
    // Generated code is only visible in Code mode.
    setMode('code')
    setTimeout(() => editorRef.current?.goToLine(runError.line!, runError.col), 0)
  }, [runError])

  const onHelp = useCallback(() => setShowHelp((v) => !v), [])

  /** Text to save: `.lgb` (code + blocks) in Blocks mode, plain Logo otherwise. */
  const serializeProgram = useCallback((): { text: string; ext: string } => {
    if (modeRef.current === 'blocks' && blocksRef.current) {
      return { text: encodeLgb(blocksRef.current.getCode(), blocksRef.current.getState()), ext: 'lgb' }
    }
    return { text: editorRef.current?.getValue() ?? '', ext: 'lgo' }
  }, [])

  /** Open program text: restore blocks when it carries them, else show the code. */
  const openProgram = useCallback((text: string, label: string) => {
    const { code, workspace } = decodeLgb(text)
    if (workspace && blocksRef.current) {
      blocksRef.current.loadState(workspace)
      setMode('blocks')
    } else {
      editorRef.current?.setValue(code)
      setMode('code')
    }
    setOutput((prev) => prev + `Loaded ${label}\n`)
  }, [])

  const onSave = useCallback(() => {
    const { text, ext } = serializeProgram()
    const name = prompt('File name:', `program.${ext}`)
    if (name && fsRef.current) {
      fsRef.current.write(name, text)
      setOutput((prev) => prev + `Saved to ${name}\n`)
    }
  }, [serializeProgram])

  const onLoad = useCallback(() => {
    const name = prompt('File name:')
    if (name && fsRef.current) {
      const text = fsRef.current.read(name)
      if (text) openProgram(text, name)
      else setOutput((prev) => prev + `File ${name} not found\n`)
    }
  }, [openProgram])

  const onExport = useCallback(() => {
    const { text, ext } = serializeProgram()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `program.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [serializeProgram])

  const onImport = useCallback(() => fileInputRef.current?.click(), [])

  const onFileChosen = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0]
      ev.target.value = ''
      if (!file) return
      file.text().then((text) => openProgram(text, file.name))
    },
    [openProgram],
  )

  const replSubmit = useCallback(
    (line: string) => {
      const interp = interpreterRef.current
      if (!interp) return
      try {
        const result = interp.runOrThrow(line)
        if (result) setOutput((prev) => prev + result + '\n')
      } catch (e) {
        if (e instanceof LogoError) reportError(e, false)
        else throw e
      }
    },
    [reportError],
  )

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        onRun={runCode}
        onStop={stop}
        onClear={clearScreen}
        onSave={onSave}
        onLoad={onLoad}
        onExport={onExport}
        onImport={onImport}
        onHelp={onHelp}
      />
      <input ref={fileInputRef} type="file" accept=".lgo,.lgb,.logo,.txt" hidden onChange={onFileChosen} />

      <div className="main">
        <div className={`editor-panel mode-${mode}`}>
          <div className="blocks-pane" hidden={mode !== 'blocks'}>
            <BlocksPanel ref={blocksRef} onCodeChange={onBlocksCode} />
          </div>
          <div className="code-pane" hidden={mode !== 'code'}>
            <Editor ref={editorRef} onRun={runCode} />
          </div>
        </div>
        <div className="canvas-panel">
          <TurtleCanvas onReady={onCanvasReady} />
        </div>
      </div>

      <div className="bottom">
        {runError && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠</span>
            <span className="error-text">
              {runError.message}
              {runError.procName ? ` in ${runError.procName}` : ''}
            </span>
            {runError.line !== undefined && (
              <button className="error-jump" onClick={jumpToError} title="Go to the failing line">
                line {runError.line} ↗
              </button>
            )}
            <button className="error-close" onClick={() => setRunError(null)} title="Dismiss">
              ×
            </button>
          </div>
        )}
        <REPL onSubmit={replSubmit} />
        <div className="output" role="log">
          {output.split('\n').map((line, i) => (
            <div key={i} className={line.startsWith('Error:') ? 'output-error' : undefined}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <StatusBar state={turtleState} />

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  )
}
