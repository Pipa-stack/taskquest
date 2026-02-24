import { describe, it, expect } from 'vitest'
import { localDateKey, todayKey, yesterdayKey } from '../../domain/dateKey.js'

describe('localDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    // new Date(year, monthIndex, day) uses LOCAL timezone — month is 0-indexed
    expect(localDateKey(new Date(2026, 1, 24))).toBe('2026-02-24')
  })

  it('pads single-digit month with a leading zero', () => {
    expect(localDateKey(new Date(2026, 0, 15))).toBe('2026-01-15')
  })

  it('pads single-digit day with a leading zero', () => {
    expect(localDateKey(new Date(2026, 5, 5))).toBe('2026-06-05')
  })

  it('handles end of year correctly', () => {
    expect(localDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('uses the LOCAL year/month/day — not UTC', () => {
    // At 23:30 local on Dec 31, UTC+2 clocks would already be Jan 1.
    // localDateKey must still return the LOCAL Dec 31.
    const dec31Late = new Date(2026, 11, 31, 23, 30, 0)
    expect(localDateKey(dec31Late)).toBe('2026-12-31')
  })

  it('defaults to today when called with no argument', () => {
    const result = localDateKey()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('todayKey', () => {
  it('returns a string matching YYYY-MM-DD', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('is consistent with localDateKey(new Date())', () => {
    // Both are called within the same millisecond-range; may differ across midnight
    // but in practice they will agree.
    const before = localDateKey(new Date())
    const today = todayKey()
    const after = localDateKey(new Date())
    expect([before, after]).toContain(today)
  })
})

describe('yesterdayKey', () => {
  it('returns a date one day before todayKey', () => {
    const today = todayKey()
    const yesterday = yesterdayKey()
    // Parse both and confirm difference is exactly 1 day
    const t = new Date(today)
    const y = new Date(yesterday)
    const diffMs = t - y
    expect(diffMs).toBe(24 * 60 * 60 * 1000)
  })
})
