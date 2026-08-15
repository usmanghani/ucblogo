interface ToolbarProps {
  onRun: () => void
  onStop: () => void
  onClear: () => void
  onSave: () => void
  onLoad: () => void
  onHelp: () => void
}

export function Toolbar({ onRun, onStop, onClear, onSave, onLoad, onHelp }: ToolbarProps) {
  return (
    <div className="toolbar">
      <span className="toolbar-title">UCBLogo Web</span>
      <div className="toolbar-buttons">
        <button onClick={onRun} title="Run (Ctrl+Enter)">
          <span className="btn-icon">▶</span> Run
        </button>
        <button onClick={onStop} title="Stop">
          <span className="btn-icon">■</span> Stop
        </button>
        <button onClick={onClear} title="Clear Screen">
          <span className="btn-icon">✖</span> Clear
        </button>
        <button onClick={onSave} title="Save">
          <span className="btn-icon">💾</span> Save
        </button>
        <button onClick={onLoad} title="Load">
          <span className="btn-icon">📂</span> Load
        </button>
        <button onClick={onHelp} title="Help">
          <span className="btn-icon">?</span> Help
        </button>
      </div>
    </div>
  )
}
