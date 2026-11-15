import { forwardRef, useImperativeHandle, useRef } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import { dependencies } from '../../package.json'

// Serve the pinned editor and its workers from this deployment, including offline/CDN-blocked networks.
loader.config({ paths: { vs: `/monaco/${dependencies['monaco-editor']}/vs` } })
import { useProgramSession } from '../session/useProgramSession'
import type { SourceLocation } from '../interpreter/errors'

export interface EditorHandle {
  getValue: () => string
  setValue: (v: string) => void
  showError: (message: string, location?: SourceLocation) => void
  clearErrors: () => void
}

export const Editor = forwardRef<EditorHandle, { onRun: () => void }>(function Editor({ onRun }, ref) {
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const session = useProgramSession('; Welcome! This is your code pane.\n; Press Run to see what the turtle draws.\n\nCS\nREPEAT 4 [FD 100 RT 90]\n')
  const programRef = useRef(session.program)
  programRef.current = session.program
  const editorRef = useRef<unknown>(null)
  const monacoRef = useRef<any>(null)
  const modelRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const ed = editorRef.current as { getValue: () => string } | null
      return ed?.getValue() ?? programRef.current
    },
    setValue: (v: string) => {
      const ed = editorRef.current as { setValue: (v: string) => void } | null
      programRef.current = v
      session.saveProgram(v)
      ed?.setValue(v)
    },
    showError: (message: string, location?: SourceLocation) => {
      const ed = editorRef.current as any
      const model = modelRef.current ?? ed?.getModel?.()
      if (!ed || !model || !location) return
      const line = Math.max(1, Math.min(location.line, model.getLineCount()))
      const column = Math.max(1, Math.min(location.col, model.getLineMaxColumn(line)))
      const endColumn = Math.min(column + 1, model.getLineMaxColumn(line))
      monacoRef.current?.editor.setModelMarkers(model, 'ucblogo', [{
        severity: monacoRef.current.MarkerSeverity.Error,
        message,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: Math.max(column + 1, endColumn),
      }])
      ed.setPosition?.({ lineNumber: line, column })
      ed.revealPositionInCenter?.({ lineNumber: line, column })
      ed.focus?.()
    },
    clearErrors: () => {
      const model = modelRef.current ?? (editorRef.current as any)?.getModel?.()
      if (model) monacoRef.current?.editor.setModelMarkers(model, 'ucblogo', [])
    },
  }))

  const handleMount = (editorInst: unknown, monaco: unknown) => {
    editorRef.current = editorInst
    monacoRef.current = monaco
    modelRef.current = (editorInst as any).getModel?.()
    const m = monaco as {
      languages: {
        register: (args: { id: string }) => void
        setLanguageConfiguration: (lang: string, cfg: Record<string, unknown>) => void
        setMonarchTokensProvider: (lang: string, provider: Record<string, unknown>) => void
      }
      editor: {
        defineTheme: (name: string, def: Record<string, unknown>) => void
        setTheme: (name: string) => void
      }
      KeyMod: { CtrlCmd: number }
      KeyCode: { Enter: number; Slash: number }
      Range: new (startLine: number, startCol: number, endLine: number, endCol: number) => unknown
    }
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
          [/[\[\]\{\}\(\)]/, 'delimiter'],
          [/[+\-*/=<>]/, 'operator'],
        ],
      },
    })

    m.editor.defineTheme('logo-theme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7A8580', fontStyle: 'italic' },
        { token: 'string', foreground: 'A2500F' },
        { token: 'variable', foreground: '1F5FA8' },
        { token: 'keyword', foreground: '17694A', fontStyle: 'bold' },
        { token: 'number', foreground: '8A3FA0' },
        { token: 'delimiter', foreground: '4A5650' },
        { token: 'operator', foreground: '4A5650' },
      ],
      colors: {
        'editor.background': '#FFFDF8',
        'editor.foreground': '#1C2924',
        'editor.lineHighlightBackground': '#F4F0E4',
        'editorLineNumber.foreground': '#B4AFA0',
        'editorLineNumber.activeForeground': '#17694A',
      },
    })

    m.editor.setTheme('logo-theme')

    ed.addAction({
      id: 'run-logo',
      label: 'Run Logo Program',
      keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Enter],
      run: () => onRunRef.current(),
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
      <div className="session-controls">
        <button type="button" onClick={() => {
          if (window.confirm('Clear this program and its saved browser session?')) session.clearSession()
        }}>Clear saved session</button>
        <span role="status">{session.error || 'Saved in this tab as you type.'}</span>
      </div>
      <MonacoEditor
        height="100%"
        language="logo"
        value={session.program}
        onChange={value => session.saveProgram(value ?? '')}
        onMount={handleMount}
        theme="logo-theme"
        options={{
          fontSize: 15,
          fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 10 },
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
})
