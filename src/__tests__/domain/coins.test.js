import { describe, it, expect } from 'vitest'
import { coinsForTask } from '../../domain/coins.js'

describe('coinsForTask', () => {
  it('returns 0 for clone tasks (anti-farming)', () => {
    expect(coinsForTask({ isClone: true })).toBe(0)
    expect(coinsForTask({ isClone: true, difficulty: 'hard' })).toBe(0)
    expect(coinsForTask({ isClone: true, difficulty: 'easy' })).toBe(0)
  })

  it('returns 5 for easy difficulty', () => {
    expect(coinsForTask({ isClone: false, difficulty: 'easy' })).toBe(5)
  })

  it('returns 8 for medium difficulty', () => {
    expect(coinsForTask({ isClone: false, difficulty: 'medium' })).toBe(8)
  })

  it('returns 12 for hard difficulty', () => {
    expect(coinsForTask({ isClone: false, difficulty: 'hard' })).toBe(12)
  })

  it('defaults to 5 when no difficulty is set', () => {
    expect(coinsForTask({})).toBe(5)
    expect(coinsForTask({ isClone: false })).toBe(5)
  })

  it('defaults to 5 for unknown difficulty values', () => {
    expect(coinsForTask({ difficulty: 'legendary' })).toBe(5)
  })

  it('always returns a non-negative number', () => {
    const tasks = [
      {},
      { isClone: true },
      { difficulty: 'easy' },
      { difficulty: 'medium' },
      { difficulty: 'hard' },
      { isClone: true, difficulty: 'hard' },
    ]
    for (const task of tasks) {
      expect(coinsForTask(task)).toBeGreaterThanOrEqual(0)
    }
  })
})
