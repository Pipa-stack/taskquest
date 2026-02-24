import { describe, it, expect } from 'vitest'
import { offsetDateKey, parseLocalDate, formatDateLabel } from '../../domain/dateKey.js'

describe('offsetDateKey', () => {
  it('returns the same date for offset 0', () => {
    expect(offsetDateKey(0, new Date(2026, 1, 24))).toBe('2026-02-24')
  })

  it('returns the next day for offset +1', () => {
    expect(offsetDateKey(1, new Date(2026, 1, 24))).toBe('2026-02-25')
  })

  it('returns the previous day for offset -1', () => {
    expect(offsetDateKey(-1, new Date(2026, 1, 24))).toBe('2026-02-23')
  })

  it('correctly crosses a month boundary forward', () => {
    expect(offsetDateKey(1, new Date(2026, 0, 31))).toBe('2026-02-01')
  })

  it('correctly crosses a month boundary backward', () => {
    expect(offsetDateKey(-1, new Date(2026, 1, 1))).toBe('2026-01-31')
  })

  it('correctly crosses a year boundary forward', () => {
    expect(offsetDateKey(1, new Date(2025, 11, 31))).toBe('2026-01-01')
  })

  it('correctly crosses a year boundary backward', () => {
    expect(offsetDateKey(-1, new Date(2026, 0, 1))).toBe('2025-12-31')
  })

  it('supports multi-day offsets', () => {
    expect(offsetDateKey(7, new Date(2026, 1, 24))).toBe('2026-03-03')
  })

  it('returns a valid YYYY-MM-DD when no base is supplied', () => {
    expect(offsetDateKey(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('parseLocalDate', () => {
  it('parses year, month and day correctly', () => {
    const d = parseLocalDate('2026-02-24')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(1)   // February (0-indexed)
    expect(d.getDate()).toBe(24)
  })

  it('handles single-digit month/day padding', () => {
    const d = parseLocalDate('2026-01-05')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
  })

  it('round-trips with offsetDateKey(0)', () => {
    const key = '2026-06-15'
    expect(offsetDateKey(0, parseLocalDate(key))).toBe(key)
  })
})

describe('formatDateLabel', () => {
  it('formats a known date correctly', () => {
    // 2026-02-24 is a Tuesday (Martes in Spanish)
    expect(formatDateLabel('2026-02-24')).toBe('Martes, 24 Feb 2026')
  })

  it('capitalises the weekday name', () => {
    const label = formatDateLabel('2026-02-24')
    expect(label[0]).toBe(label[0].toUpperCase())
  })

  it('uses 3-letter Spanish month abbreviations', () => {
    expect(formatDateLabel('2026-01-01')).toContain('Ene')
    expect(formatDateLabel('2026-12-31')).toContain('Dic')
  })

  it('handles day-of-month without leading zero', () => {
    const label = formatDateLabel('2026-02-05')
    expect(label).toContain('5 Feb')
    expect(label).not.toContain('05')
  })
})
