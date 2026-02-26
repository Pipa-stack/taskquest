import { describe, it, expect } from 'vitest'
import { calcTeamMultiplier, computeIdleEarnings, MAX_IDLE_MINUTES } from '../../domain/idle.js'

// ── calcTeamMultiplier ────────────────────────────────────────────────────────

describe('calcTeamMultiplier', () => {
  const catalog = [
    { id: 'warrior', rarity: 'common'   },
    { id: 'mage',    rarity: 'uncommon' },
    { id: 'healer',  rarity: 'rare'     },
    { id: 'paladin', rarity: 'epic'     },
    { id: 'legend',  rarity: 'legendary'},
  ]

  it('returns 1.0 for an empty team', () => {
    expect(calcTeamMultiplier([], {}, catalog)).toBe(1.0)
    expect(calcTeamMultiplier(null, {}, catalog)).toBe(1.0)
    expect(calcTeamMultiplier(undefined, {}, catalog)).toBe(1.0)
  })

  it('computes correct contribution for common stage 1 (1.00 + 1*0.05 = 1.05)', () => {
    const result = calcTeamMultiplier(['warrior'], { warrior: 1 }, catalog)
    expect(result).toBeCloseTo(1.05)
  })

  it('computes correct contribution for uncommon stage 1 (1.05 + 1*0.06 = 1.11)', () => {
    const result = calcTeamMultiplier(['mage'], { mage: 1 }, catalog)
    expect(result).toBeCloseTo(1.11)
  })

  it('computes correct contribution for rare stage 1 (1.10 + 1*0.07 = 1.17)', () => {
    const result = calcTeamMultiplier(['healer'], { healer: 1 }, catalog)
    expect(result).toBeCloseTo(1.17)
  })

  it('computes correct contribution for epic stage 1 (1.20 + 1*0.08 = 1.28)', () => {
    const result = calcTeamMultiplier(['paladin'], { paladin: 1 }, catalog)
    expect(result).toBeCloseTo(1.28)
  })

  it('computes correct contribution for legendary stage 1 (1.35 + 1*0.10 = 1.45)', () => {
    const result = calcTeamMultiplier(['legend'], { legend: 1 }, catalog)
    expect(result).toBeCloseTo(1.45)
  })

  it('returns the average (not sum) of all team member contributions', () => {
    // warrior (1.05) + mage (1.11) → avg = (1.05 + 1.11) / 2 = 1.08
    const result = calcTeamMultiplier(['warrior', 'mage'], { warrior: 1, mage: 1 }, catalog)
    expect(result).toBeCloseTo((1.05 + 1.11) / 2)
  })

  it('defaults stage to 1 when not in characterStages', () => {
    const result = calcTeamMultiplier(['warrior'], {}, catalog)
    expect(result).toBeCloseTo(1.05)
  })

  it('uses stage from characterStages when provided', () => {
    // common stage 2: 1.00 + 2*0.05 = 1.10
    const result = calcTeamMultiplier(['warrior'], { warrior: 2 }, catalog)
    expect(result).toBeCloseTo(1.10)
  })

  it('defaults unknown character rarity to common', () => {
    const unknownCatalog = [{ id: 'unknown' }] // no rarity field
    // common stage 1: 1.00 + 1*0.05 = 1.05
    const result = calcTeamMultiplier(['unknown'], { unknown: 1 }, unknownCatalog)
    expect(result).toBeCloseTo(1.05)
  })
})

// ── computeIdleEarnings ───────────────────────────────────────────────────────

describe('computeIdleEarnings', () => {
  const NOW = 1_700_000_000_000 // fixed reference ms

  it('returns zero earnings when lastTickAt is null (first tick records timestamp)', () => {
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: null,
      energy: 100,
      energyCap: 100,
      baseCpm: 1,
      multiplier: 1,
      activeBoosts: [],
    })
    expect(result.coinsEarned).toBe(0)
    expect(result.minutesUsed).toBe(0)
    expect(result.newEnergy).toBe(100) // energy unchanged on first tick
    expect(result.newLastTickAt).toBe(NOW)
  })

  it('earns coins proportional to elapsed minutes', () => {
    const elapsed30m = 30 * 60 * 1_000
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed30m,
      energy: 100,
      energyCap: 100,
      baseCpm: 2,
      multiplier: 1,
      activeBoosts: [],
    })
    // 30 min * 2 cpm * 1 multiplier = 60 coins
    expect(result.coinsEarned).toBe(60)
    expect(result.minutesUsed).toBeCloseTo(30, 0)
    expect(result.newEnergy).toBeCloseTo(70, 0)
  })

  it('clamps elapsed minutes to MAX_IDLE_MINUTES (180)', () => {
    const elapsed300m = 300 * 60 * 1_000 // 5 hours
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed300m,
      energy: 200,
      energyCap: 200,
      baseCpm: 1,
      multiplier: 1,
      activeBoosts: [],
    })
    // Clamped at 180 min, and energy must cover all 180 min (200 > 180)
    expect(result.minutesUsed).toBeCloseTo(MAX_IDLE_MINUTES, 0)
    expect(result.coinsEarned).toBe(MAX_IDLE_MINUTES) // 1 cpm * 1 multiplier
  })

  it('produces zero earnings when energy is 0', () => {
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - 60_000,
      energy: 0,
      energyCap: 100,
      baseCpm: 5,
      multiplier: 2,
      activeBoosts: [],
    })
    expect(result.coinsEarned).toBe(0)
    expect(result.minutesUsed).toBe(0)
    expect(result.newEnergy).toBe(0)
  })

  it('limits minutesUsed to available energy when energy < elapsed minutes', () => {
    // 60 minutes elapsed, but only 10 energy remaining
    const elapsed60m = 60 * 60 * 1_000
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed60m,
      energy: 10,
      energyCap: 100,
      baseCpm: 1,
      multiplier: 1,
      activeBoosts: [],
    })
    expect(result.minutesUsed).toBeCloseTo(10, 0)
    expect(result.coinsEarned).toBe(10)
    expect(result.newEnergy).toBeCloseTo(0, 0)
  })

  it('applies boost coinMultiplier to earnings', () => {
    const elapsed10m = 10 * 60 * 1_000
    const activeBoosts = [{ id: 'coin_x2_30m', coinMultiplier: 2, expiresAt: NOW + 999_999 }]
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed10m,
      energy: 100,
      energyCap: 100,
      baseCpm: 3,
      multiplier: 1,
      activeBoosts,
    })
    // 10 min * 3 cpm * 1 team multiplier * 2 boost = 60
    expect(result.coinsEarned).toBe(60)
  })

  it('uses the highest boost multiplier when multiple coin boosts are active', () => {
    const elapsed10m = 10 * 60 * 1_000
    const activeBoosts = [
      { id: 'coin_x2_30m', coinMultiplier: 2, expiresAt: NOW + 999_999 },
      { id: 'coin_x3', coinMultiplier: 3, expiresAt: NOW + 999_999 },
    ]
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed10m,
      energy: 100,
      energyCap: 100,
      baseCpm: 1,
      multiplier: 1,
      activeBoosts,
    })
    // 10 min * 1 * 1 * 3 = 30
    expect(result.coinsEarned).toBe(30)
  })

  it('applies team multiplier correctly', () => {
    const elapsed10m = 10 * 60 * 1_000
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - elapsed10m,
      energy: 100,
      energyCap: 100,
      baseCpm: 1,
      multiplier: 1.5,
      activeBoosts: [],
    })
    // floor(10 * 1 * 1.5 * 1) = floor(15) = 15
    expect(result.coinsEarned).toBe(15)
  })

  it('newLastTickAt is always set to now', () => {
    const result = computeIdleEarnings({
      now: NOW,
      lastTickAt: NOW - 60_000,
      energy: 0,
      energyCap: 100,
      baseCpm: 1,
      multiplier: 1,
      activeBoosts: [],
    })
    expect(result.newLastTickAt).toBe(NOW)
  })
})
