import { Fragment, type ReactNode } from 'react'

type Block =
  | { kind: 'code'; text: string; closed: boolean }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; text: string }

/** Split a reply into the few block types a teacher's message needs. */
export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r/g, '').split('\n')
  let paragraph: string[] = []
  const flush = () => { if (paragraph.length) { blocks.push({ kind: 'paragraph', text: paragraph.join('\n') }); paragraph = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      flush()
      const body: string[] = []
      let closed = false
      for (i++; i < lines.length; i++) {
        if (/^\s*```\s*$/.test(lines[i])) { closed = true; break }
        body.push(lines[i])
      }
      blocks.push({ kind: 'code', text: body.join('\n'), closed })
      continue
    }
    const item = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line)
    if (item) {
      flush()
      const ordered = item[2] !== undefined
      const last = blocks.at(-1)
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item[3])
      else blocks.push({ kind: 'list', ordered, items: [item[3]] })
      continue
    }
    if (!line.trim()) { flush(); continue }
    paragraph.push(line.replace(/^#{1,6}\s+/, ''))
  }
  flush()
  return blocks
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g).filter(Boolean).map((piece, index) => {
    if (piece.length > 2 && piece.startsWith('`') && piece.endsWith('`')) return <code key={index}>{piece.slice(1, -1)}</code>
    if (piece.length > 4 && piece.startsWith('**') && piece.endsWith('**')) return <strong key={index}>{piece.slice(2, -2)}</strong>
    if (piece.length > 2 && piece.startsWith('*') && piece.endsWith('*')) return <em key={index}>{piece.slice(1, -1)}</em>
    return <Fragment key={index}>{piece}</Fragment>
  })
}

/** Render Pip's reply. Every finished code block can be sent straight to the code pane. */
export function Markdown({ text, onTry }: { text: string; onTry?: (code: string) => void }) {
  return <>
    {parseBlocks(text).map((block, index) => {
      if (block.kind === 'code') {
        return <figure className="lesson-code" key={index}>
          <pre><code>{block.text}</code></pre>
          {onTry && block.closed && block.text.trim() && <button type="button" onClick={() => onTry(block.text)}>Try it</button>}
        </figure>
      }
      if (block.kind === 'list') {
        const List = block.ordered ? 'ol' : 'ul'
        return <List key={index}>{block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</List>
      }
      return <p key={index}>{inline(block.text)}</p>
    })}
  </>
}
