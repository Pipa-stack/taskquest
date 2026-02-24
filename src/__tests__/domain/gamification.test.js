import { describe, it, expect } from 'vitest'
import {
  taskXpReward,
  xpToLevel,
  xpToNextLevel,
  calcUpdatedStreak,
  XP_PER_TASK,
  XP_PER_LEVEL,
} from '../../domain/gamification.js'

// Fixed "now" for deterministic streak tests (LOCAL date = 2026-02-24)
const NOW = new Date(2026, 1, 24, 12, 0, 0) // Feb 24 2026, noon local

describe('taskXpReward', () => {
  it('returns XP_PER_TASK for a normal task', () => {
    expect(taskXpReward({ isClone: false })).toBe(XP_PER_TASK)
  })

  it('returns XP_PER_TASK when isClone is undefined', () => {
    expect(taskXpReward({})).toBe(XP_PER_TASK)
  })

  it('returns 0 for a clone task (anti-farming)', () => {
    expect(taskXpReward({ isClone: true })).toBe(0)
  })
})

describe('xpToLevel', () => {
  it('returns level 1 at 0 XP', () => {
    expect(xpToLevel(0)).toBe(1)
  })

  it(`returns level 1 at ${XP_PER_LEVEL - 1} XP (just below threshold)`, () => {
    expect(xpToLevel(XP_PER_LEVEL - 1)).toBe(1)
  })

  it(`returns level 2 at ${XP_PER_LEVEL} XP`, () => {
    expect(xpToLevel(XP_PER_LEVEL)).toBe(2)
  })

  it('returns level 3 at double XP_PER_LEVEL', () => {
    expect(xpToLevel(XP_PER_LEVEL * 2)).toBe(3)
  })

  it('is monotonically non-decreasing', () => {
    const levels = [0, 100, 499, 500, 999, 1000, 1500].map(xpToLevel)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1])
    }
  })
})

describe('xpToNextLevel', () => {
  it('returns XP_PER_LEVEL at 0 XP', () => {
    expect(xpToNextLevel(0)).toBe(XP_PER_LEVEL)
  })

  it('returns 1 at XP_PER_LEVEL - 1', () => {
    expect(xpToNextLevel(XP_PER_LEVEL - 1)).toBe(1)
  })

  it('returns XP_PER_LEVEL right after levelling up', () => {
    expect(xpToNextLevel(XP_PER_LEVEL)).toBe(XP_PER_LEVEL)
  })

  it('always returns a value in (0, XP_PER_LEVEL]', () => {
    for (const xp of [0, 50, 100, 499, 500, 501, 1000]) {
      const n = xpToNextLevel(xp)
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThanOrEqual(XP_PER_LEVEL)
    }
  })
})

describe('calcUpdatedStreak', () => {
  it('starts streak at 1 when there is no prior activity', () => {
    const result = calcUpdatedStreak({ streak: 0, lastActiveDate: null }, NOW)
    expect(result.streak).toBe(1)
    expect(result.lastActiveDate).toBe('2026-02-24')
  })

  it('keeps streak unchanged when already active today', () => {
    const result = calcUpdatedStreak(
      { streak: 7, lastActiveDate: '2026-02-24' },
      NOW
    )
    expect(result.streak).toBe(7)
    expect(result.lastActiveDate).toBe('2026-02-24')
  })

  it('increments streak by 1 when last active yesterday', () => {
    const result = calcUpdatedStreak(
      { streak: 4, lastActiveDate: '2026-02-23' },
      NOW
    )
    expect(result.streak).toBe(5)
    expect(result.lastActiveDate).toBe('2026-02-24')
  })

  it('resets streak to 1 when there is a gap of exactly 2 days', () => {
    const result = calcUpdatedStreak(
      { streak: 10, lastActiveDate: '2026-02-22' },
      NOW
    )
    expect(result.streak).toBe(1)
    expect(result.lastActiveDate).toBe('2026-02-24')
  })

  it('resets streak to 1 when there is a long gap', () => {
    const result = calcUpdatedStreak(
      { streak: 30, lastActiveDate: '2026-01-01' },
      NOW
    )
    expect(result.streak).toBe(1)
  })

  it('always returns a positive streak', () => {
    const scenarios = [
      { streak: 0, lastActiveDate: null },
      { streak: 5, lastActiveDate: '2026-02-24' },
      { streak: 5, lastActiveDate: '2026-02-23' },
      { streak: 5, lastActiveDate: '2026-01-01' },
    ]
    for (const player of scenarios) {
      const { streak } = calcUpdatedStreak(player, NOW)
      expect(streak).toBeGreaterThan(0)
    }
  })
})
