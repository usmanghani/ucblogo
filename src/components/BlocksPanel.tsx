import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as Blockly from 'blockly'
import { defineLogoBlocks, LOGO_TOOLBOX, STARTER_WORKSPACE } from '../blocks/logoBlocks'
import { workspaceToLogo } from '../blocks/logoGenerator'

export interface BlocksPanelHandle {
  /** Current workspace state (Blockly serialization JSON). */
  getState: () => unknown
  /** Replace the workspace contents. */
  loadState: (state: unknown) => void
  /** Logo source for the current workspace. */
  getCode: () => string
  /** Remove every block. */
  clear: () => void
  /** Re-layout after the container was resized or shown. */
  resize: () => void
}

interface BlocksPanelProps {
  /** Called with fresh Logo source whenever the blocks change. */
  onCodeChange: (code: string) => void
  /** Initial workspace state; the starter program when omitted. */
  initialState?: unknown
}

const STORAGE_KEY = 'ucblogo.blocks.workspace'

function defineTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme('logoDark', {
    name: 'logoDark',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#1e1e1e',
      toolboxBackgroundColour: '#252526',
      toolboxForegroundColour: '#d4d4d4',
      flyoutBackgroundColour: '#2d2d30',
      flyoutForegroundColour: '#d4d4d4',
      flyoutOpacity: 0.95,
      scrollbarColour: '#555',
      insertionMarkerColour: '#fff',
      insertionMarkerOpacity: 0.3,
      cursorColour: '#d0d0d0',
    },
    fontStyle: { family: "'Segoe UI', system-ui, sans-serif", size: 11 },
  })
}

/** A Blockly workspace that emits Logo. */
export const BlocksPanel = forwardRef<BlocksPanelHandle, BlocksPanelProps>(function BlocksPanel({ onCodeChange, initialState }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const onCodeChangeRef = useRef(onCodeChange)
  onCodeChangeRef.current = onCodeChange

  useEffect(() => {
    const host = hostRef.current
    if (!host || wsRef.current) return
    defineLogoBlocks()
    const ws = Blockly.inject(host, {
      toolbox: LOGO_TOOLBOX as Blockly.utils.toolbox.ToolboxDefinition,
      media: `${import.meta.env.BASE_URL}blockly-media/`,
      renderer: 'zelos',
      theme: defineTheme(),
      grid: { spacing: 24, length: 3, colour: '#333', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.3 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: false },
    })
    wsRef.current = ws

    // Restore the last session's blocks, else the provided/starter program.
    let state: unknown = initialState ?? null
    if (!state) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) state = JSON.parse(saved)
      } catch {
        state = null
      }
    }
    try {
      Blockly.serialization.workspaces.load((state ?? STARTER_WORKSPACE) as { [key: string]: unknown }, ws)
    } catch {
      Blockly.serialization.workspaces.load(STARTER_WORKSPACE as { [key: string]: unknown }, ws)
    }

    const emit = () => {
      try {
        onCodeChangeRef.current(workspaceToLogo(ws))
      } catch (e) {
        onCodeChangeRef.current(`; Could not generate code: ${e instanceof Error ? e.message : String(e)}\n`)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Blockly.serialization.workspaces.save(ws)))
      } catch {
        // Storage may be unavailable; ignore.
      }
    }
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.isUiEvent || ws.isDragging()) return
      emit()
    })
    emit()

    const ro = new ResizeObserver(() => Blockly.svgResize(ws))
    ro.observe(host)
    return () => {
      ro.disconnect()
      ws.dispose()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    getState: () => (wsRef.current ? Blockly.serialization.workspaces.save(wsRef.current) : null),
    loadState: (state) => {
      const ws = wsRef.current
      if (!ws) return
      ws.clear()
      Blockly.serialization.workspaces.load(state as { [key: string]: unknown }, ws)
    },
    getCode: () => (wsRef.current ? workspaceToLogo(wsRef.current) : ''),
    clear: () => wsRef.current?.clear(),
    resize: () => {
      if (wsRef.current) Blockly.svgResize(wsRef.current)
    },
  }))

  return <div className="blocks-host" ref={hostRef} />
})
