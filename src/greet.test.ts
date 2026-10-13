import { describe, expect, it } from 'vitest'
import { greet } from './greet.ts'

describe('greet', () => {
  it('greets by name', () => {
    expect(greet('Ada')).toBe('Hello, Ada!')
  })

  it('trims surrounding whitespace', () => {
    expect(greet('  Ada  ')).toBe('Hello, Ada!')
  })

  it('falls back to the world when the name is blank', () => {
    expect(greet('   ')).toBe('Hello, world!')
  })
})
