import { describe, it, expect } from 'vitest'
import { computePowerScore } from '../../domain/power.js'

const CATALOG = [
  { id: 'warrior', rarity: 'common' },
  { id: 'mage', rarity: 'uncommon' },
  { id: 'healer', rarity: 'rare' },
  { id: 'paladin', rarity: 'epic' },
  { id: 'legend', rarity: 'legendary' },
  { id: 'ranger', rarity: 'common' },
]

describe('computePowerScore', () => {
  it('returns 0 for an empty team', () => {
    expect(computePowerScore([], {}, CATALOG)).toBe(0)
  })

  it('returns 0 for undefined / null team', () => {
    expect(computePowerScore(undefined, {}, CATALOG)).toBe(0)
    expect(computePowerScore(null, {}, CATALOG)).toBe(0)
  })

  it('applies correct rarity bases at stage 1', () => {
    // common: 10, stage1 ×1 = 10
    expect(computePowerScore(['warrior'], {}, CATALOG)).toBe(10)
    // uncommon: 18
    expect(computePowerScore(['mage'], {}, CATALOG)).toBe(18)
    // rare: 30
    expect(computePowerScore(['healer'], {}, CATALOG)).toBe(30)
    // epic: 55
    expect(computePowerScore(['paladin'], {}, CATALOG)).toBe(55)
    // legendary: 90
    expect(computePowerScore(['legend'], {}, CATALOG)).toBe(90)
  })

  it('applies stage multipliers correctly', () => {
    // common base=10, stage2 ×1.35 = round(13.5) = 14? let's check: Math.round(10*1.35)=14
    expect(computePowerScore(['warrior'], { warrior: 2 }, CATALOG)).toBe(Math.round(10 * 1.35))
    // common base=10, stage3 ×1.8 = 18
    expect(computePowerScore(['warrior'], { warrior: 3 }, CATALOG)).toBe(Math.round(10 * 1.8))
  })

  it('defaults to stage 1 for characters not in characterStages', () => {
    // warrior at stage 1 = 10
    expect(computePowerScore(['warrior'], {}, CATALOG)).toBe(10)
    expect(computePowerScore(['warrior'], { mage: 3 }, CATALOG)).toBe(10)
  })

  it('sums scores for a multi-character team', () => {
    // warrior(10) + mage(18) = 28
    expect(computePowerScore(['warrior', 'mage'], {}, CATALOG)).toBe(28)
  })

  it('sums top-3 for a team of 3', () => {
    // warrior(10) + mage(18) + healer(30) = 58
    expect(computePowerScore(['warrior', 'mage', 'healer'], {}, CATALOG)).toBe(58)
  })

  it('handles unknown character ids gracefully (score = 0)', () => {
    expect(computePowerScore(['unknown_char'], {}, CATALOG)).toBe(0)
  })

  it('handles empty catalog gracefully', () => {
    expect(computePowerScore(['warrior'], {}, [])).toBe(0)
  })

  it('works with null characterStages', () => {
    expect(computePowerScore(['warrior'], null, CATALOG)).toBe(10)
  })

  it('returns integer (rounds per-character scores)', () => {
    // epic: 55, stage2 ×1.35 = Math.round(74.25) = 74
    const score = computePowerScore(['paladin'], { paladin: 2 }, CATALOG)
    expect(Number.isInteger(score)).toBe(true)
    expect(score).toBe(Math.round(55 * 1.35))
  })
})
