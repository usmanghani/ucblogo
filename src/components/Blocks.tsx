import { useEffect, useRef, useState } from 'react'
import * as Blockly from 'blockly'
import { generateLogo, toolbox } from '../blocks/logo'

export function Blocks({ onRun }: { onRun: (code: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const ws = Blockly.inject(host.current!, { toolbox, trashcan: true, zoom: { controls: true, wheel: true } })
    workspace.current = ws
    const update = () => {
      try {
        setCode(generateLogo(ws))
        localStorage.setItem('ucblogo.blocks.v1', JSON.stringify(Blockly.serialization.workspaces.save(ws)))
        setError('')
      } catch (error) { setError((error as Error).message) }
    }
    try {
      const stored = localStorage.getItem('ucblogo.blocks.v1')
      if (stored) Blockly.serialization.workspaces.load(JSON.parse(stored), ws)
    } catch (error) { setError(`Cannot restore blocks: ${(error as Error).message}`) }
    ws.addChangeListener(event => { if (!event.isUiEvent) update() })
    const resize = new ResizeObserver(() => Blockly.svgResize(ws))
    resize.observe(host.current!)
    update()
    return () => { resize.disconnect(); ws.dispose(); workspace.current = null }
  }, [])
  const save = () => {
    if (!workspace.current) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(Blockly.serialization.workspaces.save(workspace.current))], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'logo-blocks.json'; link.click()
    URL.revokeObjectURL(url)
  }
  return <section aria-label="Logo blocks" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div><button disabled={!!error || !code} onClick={() => onRun(code)}>Run blocks</button>
      <button onClick={save}>Save blocks</button>
      <label>Load blocks <input type="file" accept=".json" onChange={async event => {
        const file = event.target.files?.[0]
        if (!file || !workspace.current) return
        const previous = Blockly.serialization.workspaces.save(workspace.current)
        try { Blockly.serialization.workspaces.load(JSON.parse(await file.text()), workspace.current) }
        catch (error) { Blockly.serialization.workspaces.load(previous, workspace.current); setError((error as Error).message) }
      }} /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <div ref={host} style={{ flex: 1, minHeight: 250 }} />
    <details><summary>Generated Logo</summary><pre>{code}</pre></details>
  </section>
}
