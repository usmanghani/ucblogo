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
        setMonarchTokensProvider: (lang: string, provider: Record<string, unknown>) => void
      }
      editor: {
        defineTheme: (name: string, def: Record<string, unknown>) => void
        setTheme: (name: string) => void
      }
      KeyMod: { CtrlCmd: number }
      KeyCode: { Enter: number }
    }
    const ed = editorInst as {
      addAction: (action: { id: string; label: string; keybindings: number[]; run: () => void }) => void
    }

    m.languages.register({ id: 'logo' })

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
