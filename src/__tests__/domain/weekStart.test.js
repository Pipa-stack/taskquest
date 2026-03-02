import { describe, it, expect } from 'vitest'
import { computeWeekStartKey } from '../../domain/dateKey.js'

describe('computeWeekStartKey', () => {
  it('returns same day when today is Monday', () => {
    expect(computeWeekStartKey('2024-03-25')).toBe('2024-03-25')
  })

  it('returns Monday for a Wednesday', () => {
    expect(computeWeekStartKey('2024-03-27')).toBe('2024-03-25')
  })

  it('crosses year boundary correctly', () => {
    // 2025-01-01 is a Wednesday; Monday of that week is 2024-12-30
    expect(computeWeekStartKey('2025-01-01')).toBe('2024-12-30')
  })

  it('returns Monday for a Sunday', () => {
    // 2024-03-31 is a Sunday; Monday of that week is 2024-03-25
    expect(computeWeekStartKey('2024-03-31')).toBe('2024-03-25')
  })

  it('returns Monday for a Tuesday', () => {
    expect(computeWeekStartKey('2024-03-26')).toBe('2024-03-25')
  })

  it('handles DST boundary month correctly (March last Sunday in EU)', () => {
    // 2024-03-31 is DST change day in Europe; result must still be 2024-03-25
    expect(computeWeekStartKey('2024-03-31')).toBe('2024-03-25')
  })
})
