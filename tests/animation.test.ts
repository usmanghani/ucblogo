import { afterEach, expect, it, vi } from 'vitest'
import { Turtle } from '../src/turtle/Turtle'
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

it('batches drawing updates but publishes each WAIT frame before pausing', async () => {
  vi.useFakeTimers()
  const state = vi.fn()
  const turtle = new Turtle(document.createElement('canvas'), { onStateChange: state })
  state.mockClear()
  const execution = new Interpreter({ turtle }).runAsync('FD 10 FD 20 FD 30 WAIT 60 FD 40', new AbortController().signal)
  expect(state).toHaveBeenCalledTimes(1)
  expect(state.mock.calls[0][0].y).toBe(60)
  await vi.runAllTimersAsync()
  await execution
  expect(state).toHaveBeenCalledTimes(2)
  expect(state.mock.calls[1][0].y).toBe(100)
})
