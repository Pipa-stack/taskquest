import { describe, it, expect } from 'vitest'
import { getWeekKey, weekStartDate, weekDays } from '../../domain/weekKey.js'

// Fixed reference dates for deterministic tests
// 2026-02-23 is a Monday
// 2026-02-24 is a Tuesday
// 2026-03-01 is a Sunday (end of that same week)
// 2026-03-02 is a Monday (next week starts)

const MON = new Date('2026-02-23T10:00:00')
const TUE = new Date('2026-02-24T10:00:00')
const SUN = new Date('2026-03-01T10:00:00')
const NEXT_MON = new Date('2026-03-02T10:00:00')

describe('weekStartDate', () => {
  it('returns Monday itself when given a Monday', () => {
    expect(weekStartDate(MON)).toBe('2026-02-23')
  })

  it('returns the Monday of the week when given a Tuesday', () => {
    expect(weekStartDate(TUE)).toBe('2026-02-23')
  })

  it('returns the Monday of the week when given a Sunday', () => {
    expect(weekStartDate(SUN)).toBe('2026-02-23')
  })

  it('returns the next Monday when given the following Monday', () => {
    expect(weekStartDate(NEXT_MON)).toBe('2026-03-02')
  })
})

describe('getWeekKey', () => {
  it('starts with "week-"', () => {
    expect(getWeekKey(MON)).toMatch(/^week-/)
  })

  it('is identical for all days in the same week', () => {
    const key1 = getWeekKey(MON)
    const key2 = getWeekKey(TUE)
    const key3 = getWeekKey(SUN)
    expect(key1).toBe(key2)
    expect(key2).toBe(key3)
  })

  it('differs between consecutive weeks', () => {
    expect(getWeekKey(SUN)).not.toBe(getWeekKey(NEXT_MON))
  })

  it('encodes the Monday date', () => {
    expect(getWeekKey(TUE)).toBe('week-2026-02-23')
  })

  it('resets on week boundary (Sunday → Monday)', () => {
    expect(getWeekKey(SUN)).toBe('week-2026-02-23')
    expect(getWeekKey(NEXT_MON)).toBe('week-2026-03-02')
  })
})

describe('weekDays', () => {
  it('returns 7 dates', () => {
    expect(weekDays(MON)).toHaveLength(7)
  })

  it('starts on Monday', () => {
    const days = weekDays(TUE)
    expect(days[0]).toBe('2026-02-23')
  })

  it('ends on Sunday', () => {
    const days = weekDays(TUE)
    expect(days[6]).toBe('2026-03-01')
  })

  it('contains the given date', () => {
    const days = weekDays(TUE)
    expect(days).toContain('2026-02-24')
  })

  it('days are consecutive', () => {
    const days = weekDays(MON)
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1])
      const curr = new Date(days[i])
      expect(curr - prev).toBe(86400000) // exactly 1 day apart
    }
  })
})
