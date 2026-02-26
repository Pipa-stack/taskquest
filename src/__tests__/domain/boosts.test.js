import { describe, it, expect } from 'vitest'
import {
  BOOST_CATALOG,
  getBoost,
  getActiveBoosts,
  applyBoostsToCaps,
} from '../../domain/boosts.js'

const NOW = 1_700_000_000_000 // fixed reference ms

// ── getBoost ──────────────────────────────────────────────────────────────────

describe('getBoost', () => {
  it('returns the boost definition for a known id', () => {
    const boost = getBoost('coin_x2_30m')
    expect(boost).toBeDefined()
    expect(boost.cost).toBe(120)
    expect(boost.coinMultiplier).toBe(2)
  })

  it('returns undefined for an unknown id', () => {
    expect(getBoost('nonexistent')).toBeUndefined()
  })

  it('all catalog entries have a cost and a label', () => {
    for (const boost of BOOST_CATALOG) {
      expect(typeof boost.cost).toBe('number')
      expect(typeof boost.label).toBe('string')
    }
  })
})

// ── getActiveBoosts ───────────────────────────────────────────────────────────

describe('getActiveBoosts', () => {
  it('returns empty array when boosts is empty', () => {
    expect(getActiveBoosts([], NOW)).toEqual([])
    expect(getActiveBoosts(null, NOW)).toEqual([])
    expect(getActiveBoosts(undefined, NOW)).toEqual([])
  })

  it('includes boosts whose expiresAt is in the future', () => {
    const boosts = [
      { id: 'coin_x2_30m', expiresAt: NOW + 10_000 },
    ]
    const active = getActiveBoosts(boosts, NOW)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('coin_x2_30m')
  })

  it('excludes expired boosts (expiresAt <= now)', () => {
    const boosts = [
      { id: 'coin_x2_30m', expiresAt: NOW - 1 },  // expired
      { id: 'coin_x2_2h',  expiresAt: NOW + 1 },  // still active
    ]
    const active = getActiveBoosts(boosts, NOW)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('coin_x2_2h')
  })

  it('excludes boosts with no expiresAt (instant boosts are not stored)', () => {
    const boosts = [
      { id: 'energy_refill' }, // no expiresAt
    ]
    const active = getActiveBoosts(boosts, NOW)
    expect(active).toHaveLength(0)
  })

  it('returns all active boosts when none are expired', () => {
    const boosts = [
      { id: 'coin_x2_30m', expiresAt: NOW + 1_000 },
      { id: 'energy_cap_plus50_24h', expiresAt: NOW + 5_000, energyCapBonus: 50 },
    ]
    const active = getActiveBoosts(boosts, NOW)
    expect(active).toHaveLength(2)
  })
})

// ── applyBoostsToCaps ─────────────────────────────────────────────────────────

describe('applyBoostsToCaps', () => {
  it('returns baseCap unchanged when no boosts', () => {
    expect(applyBoostsToCaps(100, [])).toBe(100)
    expect(applyBoostsToCaps(100, null)).toBe(100)
    expect(applyBoostsToCaps(100, undefined)).toBe(100)
  })

  it('adds energyCapBonus from active boosts', () => {
    const activeBoosts = [
      { id: 'energy_cap_plus50_24h', energyCapBonus: 50 },
    ]
    expect(applyBoostsToCaps(100, activeBoosts)).toBe(150)
  })

  it('stacks bonuses from multiple boosts', () => {
    const activeBoosts = [
      { id: 'boost_a', energyCapBonus: 50 },
      { id: 'boost_b', energyCapBonus: 25 },
    ]
    expect(applyBoostsToCaps(100, activeBoosts)).toBe(175)
  })

  it('ignores boosts without energyCapBonus', () => {
    const activeBoosts = [
      { id: 'coin_x2_30m', coinMultiplier: 2 },
    ]
    expect(applyBoostsToCaps(100, activeBoosts)).toBe(100)
  })

  it('works correctly with mixed boost types', () => {
    const activeBoosts = [
      { id: 'coin_x2_30m', coinMultiplier: 2 },
      { id: 'energy_cap_plus50_24h', energyCapBonus: 50 },
    ]
    expect(applyBoostsToCaps(100, activeBoosts)).toBe(150)
  })
})
