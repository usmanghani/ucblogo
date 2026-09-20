import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExamplesMenu } from '../src/components/ExamplesMenu'
import { examples } from '../src/examples/catalog'
import { Interpreter } from '../src/interpreter/interpreter'
import { Turtle } from '../src/turtle/Turtle'

afterEach(cleanup)
it('offers every drawing and allows loading the same choice again', () => {
  const onSelect = vi.fn()
  render(<ExamplesMenu onSelect={onSelect} />)
  expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Load a program…', 'Cat with whiskers', 'Farm', 'Rocket ship', 'Soccer ball'])
  const select = screen.getByRole('combobox', { name: 'Preloaded examples' })
  fireEvent.change(select, { target: { value: 'cat' } })
  expect(onSelect).toHaveBeenLastCalledWith(examples[0])
  expect(select).toHaveValue('')
  fireEvent.change(select, { target: { value: 'cat' } })
  expect(onSelect).toHaveBeenCalledTimes(2)
})
it('bundles executable sources for every menu entry', () => {
  for (const example of examples) {
    const errors: string[] = []
    const turtle = new Turtle(document.createElement('canvas'))
    new Interpreter({ turtle, onError: e => errors.push(e.message) }).run(example.source)
    expect(errors, example.title).toEqual([])
    expect(turtle.getState()).toMatchObject({ visible: false, x: 0, y: 0 })
  }
})
it('draws six long whiskers and can redraw the complete cat', () => {
  const turtle = new Turtle(document.createElement('canvas'))
  const setXY = vi.spyOn(turtle, 'setXY')
  const errors: string[] = []
  const interpreter = new Interpreter({ turtle, onError: e => errors.push(e.message) })
  interpreter.run(examples[0].source)
  for (const side of [-1, 1]) {
    expect(setXY).toHaveBeenCalledWith(108 * side, 84)
    expect(setXY).toHaveBeenCalledWith(112 * side, 57)
    expect(setXY).toHaveBeenCalledWith(105 * side, 32)
  }
  interpreter.run('CAT')
  expect(errors).toEqual([])
  expect(turtle.getState()).toMatchObject({ x: 0, y: 0, visible: false })
})
