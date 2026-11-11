import type { AttachmentAdapter, CompleteAttachment, PendingAttachment } from '@assistant-ui/react'

const MAX_SIDE = 1280
const MAX_BYTES = 2_500_000
export const DRAWING_TYPES = 'image/jpeg,image/png,image/webp,image/gif'

/** Fit a picture inside the box the model needs, keeping its shape. */
export function fitInside(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

const readDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error ?? new Error('Could not read the picture'))
  reader.readAsDataURL(file)
})

/**
 * Turn a photo into a small JPEG data URL. Re-drawing it on a canvas shrinks a phone photo
 * from megabytes to a few hundred kilobytes and drops its metadata, such as where it was taken.
 */
export async function prepareDrawing(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = fitInside(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff' // paper, for pictures with a see-through background
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const url = canvas.toDataURL('image/jpeg', 0.85)
    if (url.startsWith('data:image/jpeg')) return url
  } catch { /* fall back to the file as it is */ }
  if (file.size > MAX_BYTES) throw new Error('That picture is too large. Try a smaller photo.')
  return readDataUrl(file)
}

/** assistant-ui attachment adapter: one picture of a drawing per message. */
export const drawingAttachments: AttachmentAdapter = {
  accept: DRAWING_TYPES,
  async add({ file }): Promise<PendingAttachment> {
    return { id: crypto.randomUUID(), type: 'image', name: file.name || 'drawing', contentType: file.type, file, status: { type: 'requires-action', reason: 'composer-send' } }
  },
  async send(attachment): Promise<CompleteAttachment> {
    const image = await prepareDrawing(attachment.file)
    return { id: attachment.id, type: 'image', name: attachment.name, contentType: 'image/jpeg', status: { type: 'complete' }, content: [{ type: 'image', image }] }
  },
  async remove() {},
}
