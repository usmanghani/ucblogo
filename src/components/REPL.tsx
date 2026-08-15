import { useState, useRef, type KeyboardEvent } from 'react'

interface REPLProps {
  onSubmit: (line: string) => void
}

export function REPL({ onSubmit }: REPLProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const line = input.trim()
      if (line) {
        setHistory((prev) => [...prev, line])
        setHistoryIdx(-1)
        onSubmit(line)
        setInput('')
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx === -1) return
      const idx = historyIdx + 1
      if (idx >= history.length) {
        setHistoryIdx(-1)
        setInput('')
      } else {
        setHistoryIdx(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <div className="repl">
      <span className="repl-prompt">?</span>
      <input
        ref={inputRef}
        className="repl-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a Logo command..."
        autoFocus
      />
    </div>
  )
}
