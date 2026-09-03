import { forwardRef, useImperativeHandle, useRef } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import * as monacoEditor from 'monaco-editor/editor/editor.api'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

// Bundle Monaco with the app instead of loading it from a CDN at runtime, so
// the editor appears even offline or behind a restrictive network. Only the
// base editor worker is needed: Logo highlighting is a Monarch grammar.
declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: () => Worker }
    monaco?: typeof monacoEditor
  }
}
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = { getWorker: () => new EditorWorker() }
  window.monaco = monacoEditor
  loader.config({ monaco: monacoEditor })
}

export interface EditorError {
  message: string
  line: number
  col?: number
}

export interface EditorHandle {
  getValue: () => string
  setValue: (v: string) => void
  /** Mark an error in the gutter/text and scroll the cursor to it. */
  showError: (err: EditorError) => void
  /** Remove error markers. */
  clearErrors: () => void
  /** Move the cursor to a line and reveal it. */
  goToLine: (line: number, col?: number) => void
}

interface MonacoLike {
  languages: {
    register: (args: { id: string }) => void
    setLanguageConfiguration: (lang: string, cfg: Record<string, unknown>) => void
    setMonarchTokensProvider: (lang: string, provider: Record<string, unknown>) => void
  }
  editor: {
    defineTheme: (name: string, def: Record<string, unknown>) => void
    setTheme: (name: string) => void
    setModelMarkers: (model: unknown, owner: string, markers: unknown[]) => void
  }
  MarkerSeverity: { Error: number }
  KeyMod: { CtrlCmd: number }
  KeyCode: { Enter: number; Slash: number }
  Range: new (startLine: number, startCol: number, endLine: number, endCol: number) => unknown
}

interface EditorLike {
  getValue: () => string
  setValue: (v: string) => void
  getModel: () => { getLineContent: (line: number) => string; getLineCount: () => number; getLineMaxColumn: (line: number) => number } | null
  setPosition: (p: { lineNumber: number; column: number }) => void
  revealLineInCenter: (line: number) => void
  focus: () => void
  deltaDecorations: (old: string[], decos: unknown[]) => string[]
}

const CODE_KEY = 'ucblogo.editor.code'
const DEFAULT_PROGRAM = 'TO rainbow_spiral :size :angle\n  IF :size > 300 [STOP]\n  SETPENCOLOR (SETBGCOLOR)\n  FORWARD :size\n  RIGHT :angle\n  rainbow_spiral (:size + 2) :angle\nEND\n\nCS\nrainbow_spiral 1 89\n'

function loadSavedCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? DEFAULT_PROGRAM
  } catch {
    return DEFAULT_PROGRAM
  }
}

export const Editor = forwardRef<EditorHandle, { onRun: () => void }>(function Editor({ onRun }, ref) {
  const editorRef = useRef<EditorLike | null>(null)
  const monacoRef = useRef<MonacoLike | null>(null)
  const decorationsRef = useRef<string[]>([])
  /** Value set before Monaco finished mounting; applied on mount. */
  const pendingRef = useRef<string | null>(null)
  const initialRef = useRef<string>(loadSavedCode())

  const persist = (v: string) => {
    try {
      localStorage.setItem(CODE_KEY, v)
    } catch {
      // ignore
    }
  }

  const clearErrors = () => {
    const ed = editorRef.current
    const m = monacoRef.current
    if (!ed || !m) return
    const model = ed.getModel()
    if (model) m.editor.setModelMarkers(model, 'logo', [])
    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [])
  }

  const goToLine = (line: number, col = 1) => {
    const ed = editorRef.current
    if (!ed) return
    const model = ed.getModel()
    const lineNumber = Math.max(1, Math.min(line, model?.getLineCount() ?? line))
    ed.setPosition({ lineNumber, column: Math.max(1, col) })
    ed.revealLineInCenter(lineNumber)
    ed.focus()
  }

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() ?? pendingRef.current ?? initialRef.current,
    setValue: (v: string) => {
      clearErrors()
      if (editorRef.current) editorRef.current.setValue(v)
      else pendingRef.current = v
      persist(v)
    },
    clearErrors,
    goToLine,
    showError: (err: EditorError) => {
      const ed = editorRef.current
      const m = monacoRef.current
      if (!ed || !m) return
      const model = ed.getModel()
      if (!model) return
      const line = Math.max(1, Math.min(err.line, model.getLineCount()))
      const endCol = model.getLineMaxColumn(line)
      const startCol = Math.max(1, Math.min(err.col ?? 1, endCol))
      m.editor.setModelMarkers(model, 'logo', [
        {
          startLineNumber: line,
          startColumn: startCol,
          endLineNumber: line,
          endColumn: endCol,
          message: err.message,
          severity: m.MarkerSeverity.Error,
        },
      ])
      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [
        {
          range: new m.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: 'logo-error-line', glyphMarginClassName: 'logo-error-glyph', linesDecorationsClassName: 'logo-error-gutter' },
        },
      ])
      goToLine(line, startCol)
    },
  }))

  const handleMount = (editorInst: unknown, monaco: unknown) => {
    editorRef.current = editorInst as EditorLike
    monacoRef.current = monaco as MonacoLike
    if (pendingRef.current !== null) {
      editorRef.current.setValue(pendingRef.current)
      pendingRef.current = null
    }
    const m = monaco as MonacoLike
    const ed = editorInst as {
      addAction: (action: { id: string; label: string; keybindings: number[]; run: () => void }) => void
      getModel: () => { getLineContent: (line: number) => string } | null
      getSelection: () => { startLineNumber: number; endLineNumber: number; endColumn: number }
      executeEdits: (source: string, edits: Array<{ range: unknown; text: string }>) => void
      pushUndoStop: () => void
    }

    m.languages.register({ id: 'logo' })
    m.languages.setLanguageConfiguration('logo', {
      comments: { lineComment: ';' },
    })

    m.languages.setMonarchTokensProvider('logo', {
      defaultToken: '',
      ignoreCase: true,
      keywords: [
        'TO', 'END', 'IF', 'IFELSE', 'REPEAT', 'WHILE', 'UNTIL', 'FOR', 'DOTIMES',
        'FOREVER', 'CATCH', 'THROW', 'STOP', 'OUTPUT', 'OP', 'RUN', 'CASE',
        'TEST', 'IFTRUE', 'IFFALSE', 'BREAK', 'CONTINUE', 'GO', 'RETURN',
        'MAKE', 'NAME', 'THING', 'ERASE', 'BURY', 'UNBURY', 'BURIED',
        'TRUE', 'FALSE', 'AND', 'OR', 'NOT',
        'FORWARD', 'FD', 'BACK', 'BK', 'LEFT', 'LT', 'RIGHT', 'RT', 'HOME',
        'PENUP', 'PU', 'PENDOWN', 'PD', 'CLEARSCREEN', 'CS',
        'HIDETURTLE', 'HT', 'SHOWTURTLE', 'ST', 'SETXY', 'ARC', 'LABEL',
        'PRINT', 'SHOW', 'TYPE', 'READLIST', 'READWORD', 'READCHAR',
        'SAVE', 'LOAD', 'OPENREAD', 'OPENWRITE', 'OPENAPPEND', 'CLOSE',
        'SUM', 'DIFFERENCE', 'PRODUCT', 'QUOTIENT', 'REMAINDER', 'POWER',
        'SQRT', 'SIN', 'COS', 'ARCTAN', 'INT', 'ROUND', 'ABS', 'RANDOM',
        'FIRST', 'LAST', 'BUTFIRST', 'BF', 'BUTLAST', 'BL', 'SENTENCE', 'SE',
        'LIST', 'FPUT', 'LPUT', 'REVERSE', 'COUNT', 'MEMBERP', 'ITEM',
        'WORD', 'CHAR', 'ASCII', 'LOWERCASE', 'UPPERCASE',
        'MAP', 'FILTER', 'REDUCE', 'APPLY', 'INVOKE', 'FOREACH',
        'ARRAY', 'ARRAYTOLIST', 'LISTTOARRAY', 'SETITEM',
        'GPROP', 'PPROP', 'REMPROP',
      ],
      operators: ['+', '-', '*', '/', '=', '<>', '<', '>', '<=', '>='],
      tokenizer: {
        root: [
          [/;.*$/, 'comment'],
          [/"\w*/, 'string'],
          [/:\w*/, 'variable'],
          [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
          [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          [/[[\]{}()]/, 'delimiter'],
          [/[+\-*/=<>]/, 'operator'],
        ],
      },
    })

    m.editor.defineTheme('logo-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2a2a2a',
      },
    })

    m.editor.setTheme('logo-theme')

    ed.addAction({
      id: 'run-logo',
      label: 'Run Logo Program',
      keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Enter],
      run: () => onRun(),
    })
    ed.addAction({
      id: 'toggle-line-comment',
      label: 'Toggle Line Comment',
      keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Slash],
      run: () => {
        const model = ed.getModel()
        const sel = ed.getSelection()
        if (!model || !sel) return
        // If the selection ends at the start of a line, don't touch that line.
        const endLine = sel.endLineNumber > sel.startLineNumber && sel.endColumn === 1
          ? sel.endLineNumber - 1
          : sel.endLineNumber
        const startLine = sel.startLineNumber
        if (endLine < startLine) return
        // Comment when any selected line has uncommented content; otherwise uncomment.
        let shouldComment = false
        for (let l = startLine; l <= endLine; l++) {
          const text = model.getLineContent(l)
          if (text.trim() === '') continue
          if (!text.trimStart().startsWith(';')) {
            shouldComment = true
            break
          }
        }
        const edits: Array<{ range: unknown; text: string }> = []
        for (let l = startLine; l <= endLine; l++) {
          const text = model.getLineContent(l)
          if (text.trim() === '') continue
          const lead = text.length - text.trimStart().length
          if (shouldComment) {
            if (text.trimStart().startsWith(';')) continue
            edits.push({ range: new m.Range(l, lead + 1, l, lead + 1), text: '; ' })
          } else {
            const idx = text.indexOf(';', lead)
            if (idx < 0) continue
            const removeLen = text[idx + 1] === ' ' ? 2 : 1
            edits.push({ range: new m.Range(l, idx + 1, l, idx + 1 + removeLen), text: '' })
          }
        }
        if (edits.length) {
          ed.executeEdits('toggle-line-comment', edits)
          ed.pushUndoStop()
        }
      },
    })
  }

  return (
    <div className="editor-container">
      <MonacoEditor
        height="100%"
        language="logo"
        defaultValue={initialRef.current}
        onMount={handleMount}
        onChange={(v) => persist(v ?? '')}
        theme="logo-theme"
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: true,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
})
