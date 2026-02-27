import { describe, it, expect } from 'vitest'
import {
  BASE_RATES,
  PITY_DEFAULT,
  PITY_MIN,
  normalizeRates,
  applyGachaRareBonus,
  computeEffectivePity,
  rollGacha,
} from '../../domain/gacha.js'

// ── normalizeRates ────────────────────────────────────────────────────────────

describe('normalizeRates', () => {
  it('normalises values that already sum to 1 (no change)', () => {
    const rates = { a: 0.6, b: 0.4 }
    const result = normalizeRates(rates)
    expect(result.a).toBeCloseTo(0.6)
    expect(result.b).toBeCloseTo(0.4)
  })

  it('normalises values that sum to more than 1', () => {
    const rates = { a: 1, b: 1 }
    const result = normalizeRates(rates)
    expect(result.a).toBeCloseTo(0.5)
    expect(result.b).toBeCloseTo(0.5)
  })

  it('normalised values always sum to 1.0', () => {
    const rates = { ...BASE_RATES }
    const result = normalizeRates(rates)
    const total = Object.values(result).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('handles zero-sum rates without throwing', () => {
    const result = normalizeRates({ a: 0, b: 0 })
    expect(result.a).toBe(0)
    expect(result.b).toBe(0)
  })

  it('does not mutate the input object', () => {
    const rates = { a: 0.5, b: 0.5 }
    normalizeRates(rates)
    expect(rates.a).toBe(0.5)
  })
})

// ── BASE_RATES ────────────────────────────────────────────────────────────────

describe('BASE_RATES', () => {
  it('all base rates sum to 1.0', () => {
    const total = Object.values(BASE_RATES).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('has all expected rarities', () => {
    expect(BASE_RATES).toHaveProperty('common')
    expect(BASE_RATES).toHaveProperty('uncommon')
    expect(BASE_RATES).toHaveProperty('rare')
    expect(BASE_RATES).toHaveProperty('epic')
    expect(BASE_RATES).toHaveProperty('legendary')
  })

  it('rare rate is lower than common rate', () => {
    expect(BASE_RATES.rare).toBeLessThan(BASE_RATES.common)
  })
})

// ── applyGachaRareBonus ───────────────────────────────────────────────────────

describe('applyGachaRareBonus', () => {
  it('returns normalised base rates when bonus is 0', () => {
    const result = applyGachaRareBonus(BASE_RATES, 0)
    const total = Object.values(result).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
    expect(result.rare).toBeCloseTo(BASE_RATES.rare / 1, 10) // normalised = same since already 1.0
  })

  it('returns normalised base rates when bonus is undefined', () => {
    const result = applyGachaRareBonus(BASE_RATES, undefined)
    const total = Object.values(result).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('increases the rare rate after applying a bonus', () => {
    const base = applyGachaRareBonus(BASE_RATES, 0)
    const boosted = applyGachaRareBonus(BASE_RATES, 0.05) // gacha=5 talent
    expect(boosted.rare).toBeGreaterThan(base.rare)
  })

  it('result always sums to 1.0 after bonus', () => {
    const result = applyGachaRareBonus(BASE_RATES, 0.10) // gacha=10 talent
    const total = Object.values(result).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('all resulting rates are non-negative', () => {
    // Even a large bonus should not produce negative rates
    const result = applyGachaRareBonus(BASE_RATES, 0.10)
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not mutate the input rates object', () => {
    const rates = { ...BASE_RATES }
    const originalRare = rates.rare
    applyGachaRareBonus(rates, 0.05)
    expect(rates.rare).toBe(originalRare)
  })

  it('rare rate increases proportionally to gachaRareBonus', () => {
    const bonus1 = applyGachaRareBonus(BASE_RATES, 0.01).rare
    const bonus2 = applyGachaRareBonus(BASE_RATES, 0.02).rare
    // More bonus → higher rare rate
    expect(bonus2).toBeGreaterThan(bonus1)
  })
})

// ── computeEffectivePity ──────────────────────────────────────────────────────

describe('computeEffectivePity', () => {
  it('returns PITY_DEFAULT when pityReduction is 0', () => {
    expect(computeEffectivePity(0)).toBe(PITY_DEFAULT)
  })

  it('reduces pity by pityReduction', () => {
    expect(computeEffectivePity(5)).toBe(PITY_DEFAULT - 5)
  })

  it('clamps to PITY_MIN when pityReduction is large enough', () => {
    // PITY_DEFAULT - PITY_MIN = 10; pityReduction=10 hits the floor
    expect(computeEffectivePity(10)).toBe(PITY_MIN)
  })

  it('never goes below PITY_MIN even with very large pityReduction', () => {
    expect(computeEffectivePity(100)).toBe(PITY_MIN)
  })

  it('returns 25 for pityReduction=5 (30-5=25, above min 20)', () => {
    expect(computeEffectivePity(5)).toBe(25)
  })

  it('PITY_DEFAULT is 30 and PITY_MIN is 20', () => {
    expect(PITY_DEFAULT).toBe(30)
    expect(PITY_MIN).toBe(20)
  })

  it('pityReduction=gacha talent integration: gacha=4 → floor(4/2)=2 → pity=28', () => {
    // Simulating: pityReduction = floor(gacha/2) = floor(4/2) = 2
    const pityReduction = Math.floor(4 / 2)
    expect(computeEffectivePity(pityReduction)).toBe(28)
  })

  it('pityReduction=gacha talent integration: gacha=10 → floor(10/2)=5 → pity=25', () => {
    const pityReduction = Math.floor(10 / 2)
    expect(computeEffectivePity(pityReduction)).toBe(25)
  })
})

// ── rollGacha ────────────────────────────────────────────────────────────────

describe('rollGacha', () => {
  const PITY = 30

  it('returns a valid rarity key from the rates table', () => {
    const validRarities = Object.keys(BASE_RATES)
    // Run 20 rolls with random RNG, all results must be valid
    for (let i = 0; i < 20; i++) {
      const rarity = rollGacha(BASE_RATES, 0, PITY)
      expect(validRarities).toContain(rarity)
    }
  })

  it('always returns rare+ when pity is triggered (pityCount + 1 >= threshold)', () => {
    const rng = () => 0.999 // always pick the last entry of pity pool
    const pityThreshold = 30
    const pityCount = pityThreshold - 1 // triggers pity
    const result = rollGacha(BASE_RATES, pityCount, pityThreshold, rng)
    expect(['rare', 'epic', 'legendary']).toContain(result)
  })

  it('can return common when rng value is very low (no pity)', () => {
    // rng() = 0.0 → hits 'common' immediately (first in table at 60%)
    const result = rollGacha(BASE_RATES, 0, PITY, () => 0)
    expect(result).toBe('common')
  })

  it('does not trigger pity when pityCount + 1 < threshold', () => {
    // With deterministic low RNG, result is common (no pity forced)
    const result = rollGacha(BASE_RATES, 5, PITY, () => 0)
    expect(result).toBe('common') // common is first, RNG=0 selects it
  })

  it('pity pool output is one of rare/epic/legendary', () => {
    // Test several deterministic pity rolls
    for (const rng of [() => 0, () => 0.5, () => 0.9999]) {
      const result = rollGacha(BASE_RATES, PITY - 1, PITY, rng)
      expect(['rare', 'epic', 'legendary']).toContain(result)
    }
  })
})
