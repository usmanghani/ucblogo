// A real PNG made in code, so tests and the live smoke need no binary fixture:
// a white page with the outline of a dark square on it.
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = data => { let c = 0xffffffff; for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc(body), body.length + 4)
  return out
}

export function drawingPng(size = 96) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const stride = size * 3 + 1
  const rows = Buffer.alloc(size * stride, 255)
  const near = Math.round(size / 4), far = size - near
  for (let y = 0; y < size; y++) {
    rows[y * stride] = 0 // no filter
    for (let x = 0; x < size; x++) {
      const onEdge = ((Math.abs(x - near) < 2 || Math.abs(x - far) < 2) && y >= near && y <= far) || ((Math.abs(y - near) < 2 || Math.abs(y - far) < 2) && x >= near && x <= far)
      if (onEdge) rows.fill(20, y * stride + 1 + x * 3, y * stride + 4 + x * 3)
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
