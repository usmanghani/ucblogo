import { useCallback, useEffect, useRef, useState } from 'react'
import { Interpreter } from './interpreter/interpreter'
import type { LogoError } from './interpreter/errors'
import { Turtle, type TurtleState } from './turtle/Turtle'
import { VirtualFS } from './filesystem/VirtualFS'
import { Editor, type EditorHandle } from './components/Editor'
import { ExamplesMenu } from './components/ExamplesMenu'
import { HelpPanel } from './components/HelpPanel'
import { REPL } from './components/REPL'
import { StatusBar } from './components/StatusBar'
import { TurtleCanvas } from './components/TurtleCanvas'
import type { Example } from './examples/catalog'
import type { Lesson } from './teacher/lessons'
import { useConsent, useProgress } from './teacher/progress'
import { PipFace, TeacherPanel } from './teacher/TeacherPanel'
import { useTeacher, type PageSnapshot } from './teacher/useTeacher'
import './styles/global.css'

type Pane = 'teacher' | 'code' | 'drawing'
interface RunRecord { by: 'student' | 'pip'; code: string; output: string; errors: string[]; stopped: boolean }

export default function App() {
  const [output, setOutput] = useState('')
  const [turtleState, setTurtleState] = useState<TurtleState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [pane, setPane] = useState<Pane>('teacher')
  const [lesson, setLesson] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [checkpoint, setCheckpoint] = useState<{ before: string; after: string } | null>(null)
  const [askedAbout, setAskedAbout] = useState<RunRecord | null>(null)
  const { completed, complete } = useProgress()
  const { consent, accept } = useConsent()

  const interpreterRef = useRef<Interpreter | null>(null)
  const turtleRef = useRef<Turtle | null>(null)
  const fsRef = useRef<VirtualFS | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const runController = useRef<AbortController | null>(null)
  const activeRun = useRef<Promise<unknown>>(Promise.resolve())
  const record = useRef<{ output: string; errors: string[]; markEditor: boolean } | null>(null)
  const lastRunRef = useRef<RunRecord | null>(null)
  useEffect(() => () => runController.current?.abort(), [])

  // Hydrate the browser file system once (Save / Load, and Logo's own file primitives).
  useEffect(() => {
    const fs = new VirtualFS()
    fsRef.current = fs
    fs.initialize()
  }, [])

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    if (turtleRef.current && canvasRef.current === canvas) return
    canvasRef.current = canvas
    const turtle = new Turtle(canvas, { onStateChange: state => setTurtleState({ ...state }) })
    turtleRef.current = turtle
    interpreterRef.current = new Interpreter({
      turtle,
      fs: fsRef.current ?? undefined,
      onOutput: text => {
        if (record.current) record.current.output += text
        setOutput(previous => previous + text)
      },
      onError: error => {
        const message = error.message || String(error)
        setOutput(previous => previous + `${message}\n`)
        if (record.current) {
          record.current.errors.push(message)
          if (record.current.markEditor) editorRef.current?.showError(message, (error as LogoError).location)
        }
      },
    })
    setTurtleState(turtle.getState())
  }, [])

  /** Run the program in the code pane, animated, from a clean turtle. */
  const runCode = useCallback(async (by: 'student' | 'pip' = 'student') => {
    runController.current?.abort()
    const controller = new AbortController()
    runController.current = controller
    await activeRun.current
    if (controller.signal.aborted) return
    const code = editorRef.current?.getValue() ?? ''
    const current = { output: '', errors: [] as string[], markEditor: true }
    record.current = current
    setOutput('')
    editorRef.current?.clearErrors()
    try {
      const execution = interpreterRef.current?.runAsync(code, controller.signal) ?? Promise.resolve('')
      activeRun.current = execution
      await execution
    } finally {
      if (record.current === current) record.current = null
      if (runController.current === controller) runController.current = null
      // A run that was stopped did not finish cleanly, and Pip must not be told it did.
      const finished: RunRecord = { by, code, output: current.output.slice(0, 2000), errors: current.errors.slice(0, 5), stopped: controller.signal.aborted }
      lastRunRef.current = finished
      setLastRun(finished)
    }
  }, [])

  const stop = useCallback(() => {
    runController.current?.abort()
    setOutput(previous => previous + '\n[Stopped]\n')
  }, [])

  const clearScreen = useCallback(() => {
    runController.current?.abort()
    turtleRef.current?.clearScreen()
    setOutput('')
  }, [])

  const onSave = useCallback(() => {
    const name = prompt('File name:')
    if (name && fsRef.current) {
      fsRef.current.write(name, editorRef.current?.getValue() ?? '')
      setOutput(previous => previous + `Saved to ${name}\n`)
    }
  }, [])

  const onLoad = useCallback(() => {
    const name = prompt('File name:')
    if (!name || !fsRef.current) return
    const code = fsRef.current.read(name)
    if (code) {
      editorRef.current?.setValue(code)
      setOutput(previous => previous + `Loaded ${name}\n`)
    } else {
      setOutput(previous => previous + `File ${name} not found\n`)
    }
  }, [])

  const loadExample = useCallback((example: Example) => {
    const current = editorRef.current?.getValue() ?? ''
    if (current.trim() && current !== example.source && !window.confirm(`Replace the current program with ${example.title}? Save a copy first if you want to keep it.`)) return
    runController.current?.abort()
    editorRef.current?.setValue(example.source)
    editorRef.current?.clearErrors()
    setCheckpoint(null)
    setOutput(`Loaded ${example.title}. Press Run to draw it.\n`)
  }, [])

  const replSubmit = useCallback((line: string) => {
    if (runController.current && !runController.current.signal.aborted) {
      setOutput(previous => previous + 'Stop the running program before using the command line.\n')
      return
    }
    const result = interpreterRef.current?.evalLine(line)
    if (result) setOutput(previous => previous + result + '\n')
  }, [])

  /** Put code in the pane and run it: Pip's write_program tool, and the "Try it" buttons. */
  const showProgram = useCallback((code: string, by: 'student' | 'pip') => {
    const before = editorRef.current?.getValue() ?? ''
    editorRef.current?.setValue(code)
    setCheckpoint(before !== code ? { before, after: code } : null)
    void runCode(by)
  }, [runCode])

  const undo = useCallback(() => {
    if (!checkpoint) return
    if (editorRef.current?.getValue() === checkpoint.after) {
      runController.current?.abort()
      editorRef.current?.setValue(checkpoint.before)
      editorRef.current?.clearErrors()
    }
    setCheckpoint(null)
  }, [checkpoint])

  const getPage = useCallback((): PageSnapshot => {
    const program = editorRef.current?.getValue() ?? ''
    const run = lastRunRef.current
    return {
      program,
      lastRun: run && { by: run.by, current: run.code === program, output: run.output, errors: run.errors, stopped: run.stopped },
      lesson,
      completed,
    }
  }, [lesson, completed])

  const teacher = useTeacher({
    getPage,
    onProgram: code => showProgram(code, 'pip'),
    onLessonComplete: complete,
  })

  // Offer Pip's help once for each failed run the student started themselves.
  const runProblem = lastRun && lastRun.by === 'student' && lastRun.errors.length && lastRun !== askedAbout ? lastRun.errors[0] : null
  useEffect(() => { if (teacher.working) setAskedAbout(lastRunRef.current) }, [teacher.working])

  return (
    <div className="app" data-pane={pane}>
      <header className="masthead">
        <div className="brand"><PipFace /><span>Logo Teacher</span></div>
        <nav className="masthead-tools" aria-label="Workspace">
          <ExamplesMenu onSelect={loadExample} />
          <button type="button" onClick={() => setShowHelp(value => !value)} title="Help">Logo words</button>
        </nav>
      </header>

      <main className="classroom">
        <TeacherPanel
          teacher={teacher}
          consent={consent}
          onConsent={accept}
          completed={completed}
          lesson={lesson}
          onLesson={(picked: Lesson | null) => setLesson(picked?.id ?? null)}
          onTry={code => { showProgram(code, 'student'); setPane('drawing') }}
          runProblem={runProblem}
        />

        <section className="canvas-area" aria-label="Your Logo workspace">
          <section className="pane code-pane" aria-label="Code">
            <header className="pane-header">
              <h2>Code</h2>
              <div className="pane-actions">
                {checkpoint && <button type="button" onClick={undo}>Undo change</button>}
                <button type="button" onClick={onSave}>Save</button>
                <button type="button" onClick={onLoad}>Load</button>
              </div>
            </header>
            <div className="editor-panel"><Editor ref={editorRef} onRun={() => void runCode('student')} /></div>
          </section>

          <section className="pane drawing-pane" aria-label="Drawing">
            <header className="pane-header">
              <h2>Drawing</h2>
              <div className="pane-actions">
                <button type="button" className="run" onClick={() => void runCode('student')} title="Run (Ctrl+Enter)">▶ Run</button>
                <button type="button" onClick={stop} title="Stop">■ Stop</button>
                <button type="button" onClick={clearScreen} title="Clear Screen">Clear</button>
              </div>
            </header>
            <div className="canvas-panel"><TurtleCanvas onReady={onCanvasReady} /></div>
            <StatusBar state={turtleState} />
            <div className="output" role="log" aria-label="Printed output">
              {output.split('\n').map((line, index) => <div key={index}>{line}</div>)}
            </div>
            <REPL onSubmit={replSubmit} />
          </section>
        </section>
      </main>

      <nav className="pane-tabs" aria-label="Show">
        {([['teacher', 'Pip'], ['code', 'Code'], ['drawing', 'Drawing']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={pane === id} onClick={() => setPane(id)}>{label}</button>)}
      </nav>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  )
}
