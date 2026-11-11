import { examples } from '../examples/catalog'

/** Anything the menu can load: a built-in example or one of the student's own programs. */
export interface LoadableProgram { title: string; source: string }

export function ExamplesMenu({ onSelect, mine = [] }: { onSelect: (program: LoadableProgram) => void; mine?: ReadonlyArray<LoadableProgram & { id: string }> }) {
  const builtIn = examples.map(example => <option key={example.id} value={example.id}>{example.title}</option>)
  return <label className="examples-menu">
    <span>Examples</span>
    <select aria-label="Preloaded examples" value="" onChange={event => {
      const choice = event.target.value
      const program = choice.startsWith('mine:') ? mine.find(item => `mine:${item.id}` === choice) : examples.find(item => item.id === choice)
      if (program) onSelect(program)
    }}>
      <option value="" disabled>Load a program…</option>
      {mine.length === 0 ? builtIn : <>
        <optgroup label="My programs">{mine.map(program => <option key={program.id} value={`mine:${program.id}`}>{program.title}</option>)}</optgroup>
        <optgroup label="Built in">{builtIn}</optgroup>
      </>}
    </select>
  </label>
}
