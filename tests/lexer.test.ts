import { describe, it, expect } from 'vitest'
import { tokenize } from '../src/interpreter/lexer'

describe('lexer', () => {
  it('tokenizes simple commands', () => {
    const tokens = tokenize('forward 100')
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ['WORD', 'forward'],
      ['NUMBER', '100'],
      ['EOF', ''],
    ])
  })

  it('tokenizes quoted words and variable refs', () => {
    const tokens = tokenize('make "x :y')
    expect(tokens[0]).toMatchObject({ type: 'WORD', value: 'make' })
    expect(tokens[1]).toMatchObject({ type: 'STRING', value: 'x' })
    expect(tokens[2]).toMatchObject({ type: 'VARREF', value: 'y' })
  })

  it('tokenizes list and array delimiters', () => {
    const tokens = tokenize('[a b] {c d}')
    expect(tokens.map((t) => t.type)).toEqual([
      'LBRACKET', 'WORD', 'WORD', 'RBRACKET',
      'LBRACE', 'WORD', 'WORD', 'RBRACE',
      'EOF',
    ])
  })

  it('handles comments', () => {
    const tokens = tokenize('print 5 ; this is a comment\nprint 6')
    expect(tokens.filter((t) => t.type === 'NUMBER').map((t) => t.value)).toEqual(['5', '6'])
  })

  it('tokenizes infix operators', () => {
    const tokens = tokenize('2 + 3 * 4')
    expect(tokens.filter((t) => t.type === 'OP').map((t) => t.value)).toEqual(['+', '*'])
  })

  it('tokenizes negative numbers', () => {
    const tokens = tokenize('-5')
    expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '-5' })
  })

  it('tokenizes TO ... END blocks', () => {
    const tokens = tokenize('to square :n repeat 4 [fd :n rt 90] end')
    const words = tokens.filter((t) => t.type === 'WORD').map((t) => t.value)
    expect(words).toContain('to')
    expect(words).toContain('end')
  })
})
