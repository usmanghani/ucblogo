import { describe, it, expect, beforeEach } from 'vitest'
import { VirtualFS } from '../src/filesystem/VirtualFS'

describe('VirtualFS', () => {
  let fs: VirtualFS

  beforeEach(() => {
    fs = new VirtualFS()
  })

  it('writes and reads files', () => {
    fs.write('test.lgo', 'PRINT [HELLO]')
    expect(fs.read('test.lgo')).toBe('PRINT [HELLO]')
    expect(fs.exists('test.lgo')).toBe(true)
  })

  it('normalizes leading quotes', () => {
    fs.write('"test.lgo', 'x')
    expect(fs.exists('test.lgo')).toBe(true)
    expect(fs.read('"test.lgo')).toBe('x')
  })

  it('erases files', () => {
    fs.write('a.lgo', 'x')
    fs.erase('a.lgo')
    expect(fs.exists('a.lgo')).toBe(false)
    expect(fs.read('a.lgo')).toBe('')
  })

  it('lists files sorted', () => {
    fs.write('b.lgo', '')
    fs.write('a.lgo', '')
    expect(fs.list()).toEqual(['a.lgo', 'b.lgo'])
  })

  it('supports sequential read/write with positions', () => {
    fs.openWrite('seq.txt')
    fs.writeLine('seq.txt', 'line1')
    fs.writeLine('seq.txt', 'line2')
    fs.close('seq.txt')

    fs.openRead('seq.txt')
    expect(fs.readLine('seq.txt')).toBe('line1')
    expect(fs.readLine('seq.txt')).toBe('line2')
    expect(fs.eof('seq.txt')).toBe(true)
    fs.close('seq.txt')
  })

  it('supports append mode', () => {
    fs.openWrite('app.txt')
    fs.writeLine('app.txt', 'first')
    fs.close('app.txt')

    fs.openAppend('app.txt')
    fs.writeLine('app.txt', 'second')
    fs.close('app.txt')

    expect(fs.read('app.txt')).toBe('first\nsecond\n')
  })

  it('tracks open files', () => {
    fs.openWrite('o.txt')
    expect(fs.allOpen()).toContain('o.txt')
    fs.closeAll()
    expect(fs.allOpen()).toEqual([])
  })
})
