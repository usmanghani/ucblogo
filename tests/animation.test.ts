import { afterEach, expect, it, vi } from 'vitest'
import { Interpreter } from '../src/interpreter/interpreter'

afterEach(() => vi.useRealTimers())
it('WAIT pauses nested procedures and repeats without advancing their side effects', async () => {
  vi.useFakeTimers()
  const output: string[] = []
  const interpreter = new Interpreter({ onOutput: s => output.push(s.trim()) })
  const execution = interpreter.runAsync('TO TICK\nPRINT REPCOUNT WAIT 60\nEND\nREPEAT 2 [TICK] PRINT 99', new AbortController().signal)
  expect(output).toEqual(['1'])
  await vi.advanceTimersByTimeAsync(999)
  expect(output).toEqual(['1'])
  await vi.advanceTimersByTimeAsync(1)
  expect(output).toEqual(['1', '2'])
  await vi.advanceTimersByTimeAsync(1000)
  await execution
  expect(output).toEqual(['1', '2', '99'])
})
it('Stop cancels a pending WAIT and no subsequent commands run', async () => {
  vi.useFakeTimers()
  const output: string[] = []
  const interpreter = new Interpreter({ onOutput: s => output.push(s.trim()) })
  const controller = new AbortController()
  const execution = interpreter.runAsync('PRINT 1 WAIT 60 PRINT 2', controller.signal)
  controller.abort()
  await execution
  await vi.runAllTimersAsync()
  expect(output).toEqual(['1'])
  expect(vi.getTimerCount()).toBe(0)
  await interpreter.runAsync('PRINT 3', new AbortController().signal)
  expect(output).toEqual(['1', '3'])
})
it('yields during long loops so Stop can interrupt programs without WAIT', async () => {
  vi.useFakeTimers()
  const errors: string[] = []
  const interpreter = new Interpreter({ onError: e => errors.push(e.message) })
  const controller = new AbortController()
  const execution = interpreter.runAsync('FOREVER [MAKE "X 1]', controller.signal)
  controller.abort()
  await execution
  expect(errors).toEqual([])
})
it.each(['WAIT -1', 'WAIT 3601', 'WAIT "oops'])('rejects invalid timing: %s', async source => {
  const errors: string[] = []
  await new Interpreter({ onError: e => errors.push(e.message) }).runAsync(source, new AbortController().signal)
  expect(errors).toHaveLength(1)
})
