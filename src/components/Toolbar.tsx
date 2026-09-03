export type EditorMode = 'blocks' | 'code'

interface ToolbarProps {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  onRun: () => void
  onStop: () => void
  onClear: () => void
  onSave: () => void
  onLoad: () => void
  onExport: () => void
  onImport: () => void
  onHelp: () => void
}

export function Toolbar({ mode, onModeChange, onRun, onStop, onClear, onSave, onLoad, onExport, onImport, onHelp }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">UCBLogo Web</span>
        <div className="mode-tabs" role="tablist" aria-label="Editor mode">
          <button role="tab" aria-selected={mode === 'blocks'} className={mode === 'blocks' ? 'active' : ''} onClick={() => onModeChange('blocks')} title="Build the program from blocks">
            ⧉ Blocks
          </button>
          <button role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'active' : ''} onClick={() => onModeChange('code')} title="Edit Logo source">
            ⌨ Code
          </button>
        </div>
      </div>
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
        <button onClick={onSave} title="Save to the browser's Logo file system">
          <span className="btn-icon">💾</span> Save
        </button>
        <button onClick={onLoad} title="Load from the browser's Logo file system">
          <span className="btn-icon">📂</span> Load
        </button>
        <button onClick={onExport} title={mode === 'blocks' ? 'Download as a .lgb file (runs as Logo, keeps the blocks)' : 'Download as a .lgo file'}>
          <span className="btn-icon">⬇</span> Export
        </button>
        <button onClick={onImport} title="Open a .lgo or .lgb file from your computer">
          <span className="btn-icon">⬆</span> Import
        </button>
        <button onClick={onHelp} title="Help">
          <span className="btn-icon">?</span> Help
        </button>
      </div>
    </div>
  )
}
