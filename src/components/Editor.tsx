import { forwardRef, useImperativeHandle, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'

export interface EditorHandle {
  getValue: () => string
  setValue: (v: string) => void
}

export const Editor = forwardRef<EditorHandle, { onRun: () => void }>(function Editor({ onRun }, ref) {
  const editorRef = useRef<unknown>(null)

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const ed = editorRef.current as { getValue: () => string } | null
      return ed?.getValue() ?? ''
    },
    setValue: (v: string) => {
      const ed = editorRef.current as { setValue: (v: string) => void } | null
      ed?.setValue(v)
    },
  }))

  const handleMount = (editorInst: unknown, monaco: unknown) => {
    editorRef.current = editorInst
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
        defaultValue={'TO rainbow_spiral :size :angle\n  IF :size > 300 [STOP]\n  SETPENCOLOR (SETBGCOLOR)\n  FORWARD :size\n  RIGHT :angle\n  rainbow_spiral (:size + 2) :angle\nEND\n\nCS\nrainbow_spiral 1 89\n'}
        onMount={handleMount}
        theme="logo-theme"
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
})
