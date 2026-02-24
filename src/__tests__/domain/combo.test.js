import { describe, it, expect } from 'vitest'
import {
  calcCombo,
  applyCombo,
  COMBO_WINDOW_MS,
  MIN_COMBO,
  MAX_COMBO,
  COMBO_STEP,
} from '../../domain/combo.js'

// Fixed "now" for deterministic tests
const NOW = new Date(2026, 1, 24, 12, 0, 0) // Feb 24 2026, noon local

// Helper: ISO string N milliseconds before NOW
const msAgo = (ms) => new Date(NOW.getTime() - ms).toISOString()

describe('calcCombo – reset behaviour', () => {
  it('returns MIN_COMBO when lastCompleteAt is null (first completion ever)', () => {
    expect(calcCombo(1.3, null, NOW)).toBe(MIN_COMBO)
  })

  it('resets to MIN_COMBO when window has expired (>90s)', () => {
    const lastAt = msAgo(COMBO_WINDOW_MS + 1)
    expect(calcCombo(1.3, lastAt, NOW)).toBe(MIN_COMBO)
  })

  it('resets to MIN_COMBO when exactly 1ms over window', () => {
    const lastAt = msAgo(COMBO_WINDOW_MS + 1)
    expect(calcCombo(1.4, lastAt, NOW)).toBe(MIN_COMBO)
  })

  it('resets even from a high combo if window expired', () => {
    const lastAt = msAgo(200_000)
    expect(calcCombo(1.4, lastAt, NOW)).toBe(MIN_COMBO)
  })
})

describe('calcCombo – stepping up within window', () => {
  it('steps up from 1.0 to 1.1 within window', () => {
    const lastAt = msAgo(30_000) // 30s ago
    expect(calcCombo(1.0, lastAt, NOW)).toBe(1.1)
  })

  it('steps up from 1.1 to 1.2 within window', () => {
    const lastAt = msAgo(30_000)
    expect(calcCombo(1.1, lastAt, NOW)).toBe(1.2)
  })

  it('steps up from 1.2 to 1.3 within window', () => {
    const lastAt = msAgo(10_000)
    expect(calcCombo(1.2, lastAt, NOW)).toBe(1.3)
  })

  it('steps up from 1.3 to 1.4 within window', () => {
    const lastAt = msAgo(5_000)
    expect(calcCombo(1.3, lastAt, NOW)).toBe(1.4)
  })
})

describe('calcCombo – cap at MAX_COMBO (1.4)', () => {
  it('stays at MAX_COMBO when already at cap', () => {
    const lastAt = msAgo(5_000)
    expect(calcCombo(MAX_COMBO, lastAt, NOW)).toBe(MAX_COMBO)
  })

  it('cannot exceed 1.4 regardless of input', () => {
    const lastAt = msAgo(1_000)
    // Even if currentCombo is somehow higher, result is capped
    expect(calcCombo(1.4, lastAt, NOW)).toBe(MAX_COMBO)
  })

  it('MAX_COMBO is 1.4', () => {
    expect(MAX_COMBO).toBe(1.4)
  })
})

describe('calcCombo – boundary conditions', () => {
  it('does NOT reset when elapsed equals COMBO_WINDOW_MS exactly (boundary inclusive)', () => {
    // elapsed = COMBO_WINDOW_MS → still inside window
    const lastAt = msAgo(COMBO_WINDOW_MS)
    const result = calcCombo(1.0, lastAt, NOW)
    expect(result).toBe(1.1)
  })

  it('resets when elapsed is COMBO_WINDOW_MS + 1', () => {
    const lastAt = msAgo(COMBO_WINDOW_MS + 1)
    expect(calcCombo(1.2, lastAt, NOW)).toBe(MIN_COMBO)
  })
})

describe('applyCombo', () => {
  it('applies combo multiplier to base XP (rounded)', () => {
    expect(applyCombo(100, 1.2, false)).toBe(120)
  })

  it('rounds to nearest integer', () => {
    expect(applyCombo(100, 1.1, false)).toBe(110)
    expect(applyCombo(100, 1.3, false)).toBe(130)
  })

  it('does NOT apply combo to clone tasks', () => {
    expect(applyCombo(100, 1.4, true)).toBe(100)
  })

  it('returns 0 unchanged for 0 XP (clone)', () => {
    expect(applyCombo(0, 1.4, false)).toBe(0)
  })

  it('returns base XP unchanged when combo is MIN_COMBO (1.0)', () => {
    expect(applyCombo(100, MIN_COMBO, false)).toBe(100)
  })
})
