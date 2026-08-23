import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom has no canvas backend: every getContext('2d') returns null.
// Give every canvas a recording mock context (Turtle's offscreen buffer included).
function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    font: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
  }
}

HTMLCanvasElement.prototype.getContext = function () {
  return createMockCtx()
} as unknown as typeof HTMLCanvasElement.prototype.getContext
