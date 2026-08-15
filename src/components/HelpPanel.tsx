import { useState, useMemo } from 'react'
import { findHelp } from '../help/helpData'

interface HelpPanelProps {
  onClose: () => void
}

const CATEGORIES = ['All', 'Turtle', 'Arithmetic', 'Predicates', 'Lists', 'Words', 'I/O', 'Control', 'Workspace', 'Arrays', 'Properties']

export function HelpPanel({ onClose }: HelpPanelProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const results = useMemo(() => {
    let entries = findHelp(query)
    if (category !== 'All') {
      entries = entries.filter((e) => e.category === category)
    }
    return entries
  }, [query, category])

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h2>UCBLogo Help</h2>
          <button className="help-close" onClick={onClose}>
            ×
          </button>
        </div>
        <input className="help-search" type="text" placeholder="Search commands..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="help-categories">
          {CATEGORIES.map((cat) => (
            <button key={cat} className={`help-cat ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
        <div className="help-results">
          {results.length === 0 && <p className="help-empty">No commands found.</p>}
          {results.map((entry) => (
            <div key={entry.name} className="help-entry">
              <div className="help-entry-header">
                <code className="help-name">{entry.name}</code>
                {entry.aliases.map((a) => (
                  <code key={a} className="help-alias">
                    {a}
                  </code>
                ))}
                <span className="help-category">{entry.category}</span>
              </div>
              <p className="help-desc">{entry.description}</p>
              {entry.example && (
                <pre className="help-example">
                  <code>{entry.example}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
