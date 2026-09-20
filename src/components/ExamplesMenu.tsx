import { examples, type Example } from '../examples/catalog'

export function ExamplesMenu({ onSelect }: { onSelect: (example: Example) => void }) {
  return <label className="examples-menu">
    <span>Examples</span>
    <select aria-label="Preloaded examples" value="" onChange={event => {
      const example = examples.find(item => item.id === event.target.value)
      if (example) onSelect(example)
    }}>
      <option value="" disabled>Load a program…</option>
      {examples.map(example => <option key={example.id} value={example.id}>{example.title}</option>)}
    </select>
  </label>
}
