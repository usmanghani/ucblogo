/**
 * The `.lgb` ("Logo blocks") file format.
 *
 * A blocks program is saved as ordinary Logo source — exactly what the block
 * generator emitted — followed by the Blockly workspace serialized as JSON
 * inside Logo comment lines. Any Logo interpreter (the web app, the CLI, or
 * another Logo) runs the file as plain Logo because comments are ignored,
 * while the web app can restore the block layout from the trailer.
 *
 *   FD 100
 *   RT 90
 *
 *   ; @logoblocks v1
 *   ; {"blocks":{"languageVersion":0,"blocks":[...]}}
 *   ; @end
 *
 * The JSON is split over several comment lines when long; each line is a
 * complete, independent chunk so lines can be re-joined verbatim.
 */

export const LGB_MARKER = '; @logoblocks v1'
export const LGB_END = '; @end'
const CHUNK = 200

export interface LgbFile {
  /** The runnable Logo source (without the blocks trailer). */
  code: string
  /** The Blockly workspace state (as returned by Blockly.serialization.workspaces.save). */
  workspace: unknown | null
}

/** Serialize Logo code plus a workspace state into `.lgb` text. */
export function encodeLgb(code: string, workspace: unknown): string {
  const json = JSON.stringify(workspace)
  const lines: string[] = []
  for (let i = 0; i < json.length; i += CHUNK) lines.push('; ' + json.slice(i, i + CHUNK))
  const body = code.replace(/\s+$/, '')
  return `${body}\n\n${LGB_MARKER}\n${lines.join('\n')}\n${LGB_END}\n`
}

/** Split `.lgb` text (or plain Logo) into code and workspace state. */
export function decodeLgb(text: string): LgbFile {
  const start = text.indexOf(LGB_MARKER)
  if (start < 0) return { code: text, workspace: null }
  const code = text.slice(0, start).replace(/\s+$/, '') + '\n'
  const rest = text.slice(start + LGB_MARKER.length)
  const end = rest.indexOf(LGB_END)
  const trailer = end < 0 ? rest : rest.slice(0, end)
  const json = trailer
    .split('\n')
    .map((l) => l.replace(/^\s*;\s?/, ''))
    .join('')
    .trim()
  if (!json) return { code, workspace: null }
  try {
    return { code, workspace: JSON.parse(json) }
  } catch {
    return { code, workspace: null }
  }
}

/** True if the text carries a blocks trailer. */
export function isLgb(text: string): boolean {
  return text.includes(LGB_MARKER)
}
