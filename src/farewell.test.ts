import { describe, expect, it } from 'vitest'
import { farewell } from './farewell.ts'

describe('farewell', () => {
  it('says goodbye by name', () => {
    expect(farewell('Ada')).toBe('Goodbye, Ada!')
  })

  it('falls back to the world when the name is blank', () => {
    expect(farewell('   ')).toBe('Goodbye, world!')
  })
})
