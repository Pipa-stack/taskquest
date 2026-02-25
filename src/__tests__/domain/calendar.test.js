import { describe, it, expect } from 'vitest'
import { getMonthMatrix, monthLabel } from '../../domain/calendar.js'

// ── getMonthMatrix ──────────────────────────────────────────────────────────

describe('getMonthMatrix – structure', () => {
  it('each row has exactly 7 elements', () => {
    // Test several months to be thorough
    const months = [
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
      '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    ]
    for (const dk of months) {
      const matrix = getMonthMatrix(dk)
      for (const week of matrix) {
        expect(week).toHaveLength(7)
      }
    }
  })

  it('returns at most 6 rows for any month', () => {
    // Exhaustively test every month from 2020-2030
    for (let year = 2020; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        const dk = `${year}-${String(month).padStart(2, '0')}-01`
        const matrix = getMonthMatrix(dk)
        expect(matrix.length).toBeLessThanOrEqual(6)
      }
    }
  })

  it('contains exactly the correct number of day cells per month', () => {
    // 28 days in Feb 2026 (non-leap)
    expect(getMonthMatrix('2026-02-01').flat().filter(Boolean)).toHaveLength(28)
    // 29 days in Feb 2028 (leap)
    expect(getMonthMatrix('2028-02-01').flat().filter(Boolean)).toHaveLength(29)
    // 31 days in January
    expect(getMonthMatrix('2026-01-01').flat().filter(Boolean)).toHaveLength(31)
    // 30 days in April
    expect(getMonthMatrix('2026-04-01').flat().filter(Boolean)).toHaveLength(30)
  })

  it('day cells are sequential YYYY-MM-DD strings', () => {
    const days = getMonthMatrix('2026-02-01').flat().filter(Boolean)
    expect(days[0]).toBe('2026-02-01')
    expect(days[days.length - 1]).toBe('2026-02-28')
  })
})

describe('getMonthMatrix – Monday-first week (very important)', () => {
  // Feb 1 2026 is a Sunday → in Mon-first grid it sits at index 6
  it('Feb 2026: first day (Sunday) is at column index 6', () => {
    const matrix = getMonthMatrix('2026-02-01')
    const firstRow = matrix[0]
    expect(firstRow[6]).toBe('2026-02-01')
    // Columns 0-5 are padding nulls
    expect(firstRow.slice(0, 6)).toEqual([null, null, null, null, null, null])
  })

  // Jan 1 2026 is a Thursday → Mon-first index 3
  it('Jan 2026: first day (Thursday) is at column index 3', () => {
    const matrix = getMonthMatrix('2026-01-01')
    const firstRow = matrix[0]
    expect(firstRow[3]).toBe('2026-01-01')
    expect(firstRow.slice(0, 3)).toEqual([null, null, null])
  })

  // March 1 2026 is a Sunday → Mon-first index 6
  it('March 2026: first day (Sunday) is at column index 6', () => {
    const matrix = getMonthMatrix('2026-03-01')
    expect(matrix[0][6]).toBe('2026-03-01')
  })

  // May 1 2026 is a Friday → Mon-first index 4
  it('May 2026: first day (Friday) is at column index 4', () => {
    const matrix = getMonthMatrix('2026-05-01')
    expect(matrix[0][4]).toBe('2026-05-01')
  })

  // Monday-starting month: March 2 2026 next Monday? Let me use a known Monday-start.
  // June 1 2026: Jan=Thu, Feb=Sun, Mar=Sun, Apr=Wed, May=Fri, Jun=Mon
  it('June 2026: first day (Monday) is at column index 0', () => {
    const matrix = getMonthMatrix('2026-06-01')
    expect(matrix[0][0]).toBe('2026-06-01')
    // No padding at the start
    expect(matrix[0].filter((c) => c === null)).toHaveLength(0)
  })

  it('accepts any day of the month, not just the 1st', () => {
    // Should produce the same matrix for any day in the same month
    const fromFirst = getMonthMatrix('2026-02-01')
    const fromMiddle = getMonthMatrix('2026-02-15')
    const fromLast = getMonthMatrix('2026-02-28')
    expect(fromFirst).toEqual(fromMiddle)
    expect(fromFirst).toEqual(fromLast)
  })
})

describe('getMonthMatrix – null padding', () => {
  it('cells before the 1st are null', () => {
    // Feb 2026 starts on Sunday (index 6), so first 6 cells are null
    const matrix = getMonthMatrix('2026-02-01')
    const allCells = matrix.flat()
    const firstNonNull = allCells.findIndex((c) => c !== null)
    expect(firstNonNull).toBe(6)
  })

  it('cells after the last day are null', () => {
    // Feb 2026 ends on Saturday (index 5 = 6th column, 0-based)
    // 28 days + 6 padding = 34, padded to 35 (5 weeks)
    const matrix = getMonthMatrix('2026-02-01')
    const allCells = matrix.flat()
    const lastNonNull = [...allCells].reverse().findIndex((c) => c !== null)
    // Feb 28 2026 is Saturday = column 5 in Mon-first; column 6 (Sunday) is null
    expect(lastNonNull).toBe(1) // 1 null after the last day
  })
})

// ── monthLabel ──────────────────────────────────────────────────────────────

describe('monthLabel', () => {
  it('returns "Febrero 2026" for any Feb 2026 date', () => {
    expect(monthLabel('2026-02-01')).toBe('Febrero 2026')
    expect(monthLabel('2026-02-15')).toBe('Febrero 2026')
    expect(monthLabel('2026-02-28')).toBe('Febrero 2026')
  })

  it('returns "Enero 2026"', () => {
    expect(monthLabel('2026-01-15')).toBe('Enero 2026')
  })

  it('returns "Diciembre 2025"', () => {
    expect(monthLabel('2025-12-31')).toBe('Diciembre 2025')
  })

  it('returns "Marzo 2026"', () => {
    expect(monthLabel('2026-03-01')).toBe('Marzo 2026')
  })

  it('returns correct label for every month', () => {
    const expected = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]
    for (let m = 1; m <= 12; m++) {
      const dk = `2026-${String(m).padStart(2, '0')}-01`
      expect(monthLabel(dk)).toBe(`${expected[m - 1]} 2026`)
    }
  })
})
