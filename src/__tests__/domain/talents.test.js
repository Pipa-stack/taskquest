import { describe, it, expect } from 'vitest'
import {
  TALENT_MAX,
  costForNextPoint,
  totalCost,
  computeTalentBonuses,
  canSpendEssence,
  applySpendEssence,
} from '../../domain/talents.js'

// ── costForNextPoint ──────────────────────────────────────────────────────────

describe('costForNextPoint', () => {
  it('costs 1 to buy the first point (from 0)', () => {
    expect(costForNextPoint(0)).toBe(1)
  })

  it('costs 5 to buy the 5th point (from 4)', () => {
    expect(costForNextPoint(4)).toBe(5)
  })

  it('costs 10 to buy the 10th point (from 9)', () => {
    expect(costForNextPoint(9)).toBe(10)
  })

  it('returns currentPoints + 1 for any value', () => {
    for (let i = 0; i < TALENT_MAX; i++) {
      expect(costForNextPoint(i)).toBe(i + 1)
    }
  })
})

// ── totalCost ─────────────────────────────────────────────────────────────────

describe('totalCost', () => {
  it('returns 0 for 0 points', () => {
    expect(totalCost(0)).toBe(0)
  })

  it('returns 1 for 1 point', () => {
    expect(totalCost(1)).toBe(1)
  })

  it('returns 3 for 2 points (1+2)', () => {
    expect(totalCost(2)).toBe(3)
  })

  it('returns 6 for 3 points (1+2+3)', () => {
    expect(totalCost(3)).toBe(6)
  })

  it('returns 10 for 4 points (1+2+3+4)', () => {
    expect(totalCost(4)).toBe(10)
  })

  it('returns 55 for 10 points (1+2+...+10)', () => {
    expect(totalCost(10)).toBe(55)
  })

  it('equals the sum of costForNextPoint for each step', () => {
    for (let p = 1; p <= TALENT_MAX; p++) {
      let sum = 0
      for (let i = 0; i < p; i++) sum += costForNextPoint(i)
      expect(totalCost(p)).toBe(sum)
    }
  })

  it('handles negative input gracefully (returns 0)', () => {
    expect(totalCost(-1)).toBe(0)
  })
})

// ── computeTalentBonuses ──────────────────────────────────────────────────────

describe('computeTalentBonuses', () => {
  it('returns baseline values when all branches are 0', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 0 })
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
    expect(bonuses.energyCapBonus).toBe(0)
    expect(bonuses.gachaRareBonus).toBeCloseTo(0)
    expect(bonuses.pityReduction).toBe(0)
    expect(bonuses.powerMult).toBeCloseTo(1.0)
    expect(bonuses.evolveDiscount).toBeCloseTo(0)
  })

  it('handles undefined/null talents gracefully', () => {
    const bonuses = computeTalentBonuses(undefined)
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
    expect(bonuses.energyCapBonus).toBe(0)
  })

  it('handles empty object talents gracefully', () => {
    const bonuses = computeTalentBonuses({})
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
  })

  // Idle branch
  it('idle=3: idleCoinMult = 1.09, energyCapBonus = 5', () => {
    const bonuses = computeTalentBonuses({ idle: 3, gacha: 0, power: 0 })
    expect(bonuses.idleCoinMult).toBeCloseTo(1.09)
    expect(bonuses.energyCapBonus).toBe(5)
  })

  it('idle=6: idleCoinMult = 1.18, energyCapBonus = 10', () => {
    const bonuses = computeTalentBonuses({ idle: 6, gacha: 0, power: 0 })
    expect(bonuses.idleCoinMult).toBeCloseTo(1.18)
    expect(bonuses.energyCapBonus).toBe(10)
  })

  it('idle=10 (max): idleCoinMult = 1.30, energyCapBonus = 15', () => {
    const bonuses = computeTalentBonuses({ idle: 10, gacha: 0, power: 0 })
    expect(bonuses.idleCoinMult).toBeCloseTo(1.30)
    expect(bonuses.energyCapBonus).toBe(15)
  })

  // energyCapBonus only increments every 3 idle points
  it('idle=2: energyCapBonus = 0 (not yet at 3)', () => {
    expect(computeTalentBonuses({ idle: 2 }).energyCapBonus).toBe(0)
  })

  it('idle=4: energyCapBonus = 5 (floor(4/3)=1)', () => {
    expect(computeTalentBonuses({ idle: 4 }).energyCapBonus).toBe(5)
  })

  // Gacha branch
  it('gacha=1: gachaRareBonus = 0.01, pityReduction = 0', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 1, power: 0 })
    expect(bonuses.gachaRareBonus).toBeCloseTo(0.01)
    expect(bonuses.pityReduction).toBe(0)
  })

  it('gacha=2: gachaRareBonus = 0.02, pityReduction = 1', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 2, power: 0 })
    expect(bonuses.gachaRareBonus).toBeCloseTo(0.02)
    expect(bonuses.pityReduction).toBe(1)
  })

  it('gacha=10: gachaRareBonus = 0.10, pityReduction = 5', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 10, power: 0 })
    expect(bonuses.gachaRareBonus).toBeCloseTo(0.10)
    expect(bonuses.pityReduction).toBe(5)
  })

  // Power branch
  it('power=3: powerMult = 1.12, evolveDiscount = 0.05', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 3 })
    expect(bonuses.powerMult).toBeCloseTo(1.12)
    expect(bonuses.evolveDiscount).toBeCloseTo(0.05)
  })

  it('power=6: powerMult = 1.24, evolveDiscount = 0.10', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 6 })
    expect(bonuses.powerMult).toBeCloseTo(1.24)
    expect(bonuses.evolveDiscount).toBeCloseTo(0.10)
  })

  it('power=10 (max): powerMult = 1.40, evolveDiscount capped at 0.15 (floor(10/3)=3, 3*0.05=0.15)', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 10 })
    expect(bonuses.powerMult).toBeCloseTo(1.40)
    // floor(10/3) = 3, 3 * 0.05 = 0.15 (well below cap of 0.40)
    expect(bonuses.evolveDiscount).toBeCloseTo(0.15)
  })

  it('evolveDiscount is capped at 0.40 even if formula exceeds it', () => {
    // Simulate extreme value: power=24 → floor(24/3)*0.05 = 8*0.05 = 0.40
    // power=27 → floor(27/3)*0.05 = 9*0.05 = 0.45 → capped at 0.40
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 27 })
    expect(bonuses.evolveDiscount).toBeCloseTo(0.40)
  })
})

// ── canSpendEssence ───────────────────────────────────────────────────────────

describe('canSpendEssence', () => {
  it('returns true when player has enough essence and branch is below max', () => {
    const player = {
      essence: 10,
      talents: { idle: 0, gacha: 0, power: 0 },
    }
    expect(canSpendEssence(player, 'idle')).toBe(true)  // cost = 1, essence = 10
  })

  it('returns false when player has insufficient essence', () => {
    const player = {
      essence: 0,
      talents: { idle: 0, gacha: 0, power: 0 },
    }
    expect(canSpendEssence(player, 'idle')).toBe(false)
  })

  it('returns false when branch is already at TALENT_MAX', () => {
    const player = {
      essence: 9999,
      talents: { idle: TALENT_MAX, gacha: 0, power: 0 },
    }
    expect(canSpendEssence(player, 'idle')).toBe(false)
  })

  it('returns true when essence exactly equals the cost', () => {
    // At idle=4, cost for next = 5
    const player = {
      essence: 5,
      talents: { idle: 4, gacha: 0, power: 0 },
    }
    expect(canSpendEssence(player, 'idle')).toBe(true)
  })

  it('returns false when essence is one less than the cost', () => {
    // At idle=4, cost = 5; essence = 4 → not enough
    const player = {
      essence: 4,
      talents: { idle: 4, gacha: 0, power: 0 },
    }
    expect(canSpendEssence(player, 'idle')).toBe(false)
  })

  it('handles missing talents gracefully (defaults to 0 points)', () => {
    const player = { essence: 5 }
    // No talents → all at 0, cost = 1
    expect(canSpendEssence(player, 'gacha')).toBe(true)
  })

  it('works for all branches', () => {
    const player = { essence: 100, talents: { idle: 0, gacha: 0, power: 0 } }
    expect(canSpendEssence(player, 'idle')).toBe(true)
    expect(canSpendEssence(player, 'gacha')).toBe(true)
    expect(canSpendEssence(player, 'power')).toBe(true)
  })
})

// ── applySpendEssence ─────────────────────────────────────────────────────────

describe('applySpendEssence', () => {
  it('deducts the correct cost from essence', () => {
    const player = { essence: 10, talents: { idle: 0, gacha: 0, power: 0 }, essenceSpent: 0 }
    const updated = applySpendEssence(player, 'idle')
    // cost = 1 (buying point #1)
    expect(updated.essence).toBe(9)
  })

  it('increments the talent branch by 1', () => {
    const player = { essence: 10, talents: { idle: 2, gacha: 0, power: 0 }, essenceSpent: 0 }
    const updated = applySpendEssence(player, 'idle')
    expect(updated.talents.idle).toBe(3)
  })

  it('accumulates essenceSpent', () => {
    const player = { essence: 10, talents: { idle: 0, gacha: 0, power: 0 }, essenceSpent: 5 }
    const updated = applySpendEssence(player, 'idle')
    // cost = 1
    expect(updated.essenceSpent).toBe(6)
  })

  it('does not mutate other talent branches', () => {
    const player = { essence: 10, talents: { idle: 2, gacha: 3, power: 1 }, essenceSpent: 0 }
    const updated = applySpendEssence(player, 'gacha')
    expect(updated.talents.idle).toBe(2)
    expect(updated.talents.gacha).toBe(4)
    expect(updated.talents.power).toBe(1)
  })

  it('returns original player unchanged when essence is insufficient', () => {
    const player = { essence: 0, talents: { idle: 0, gacha: 0, power: 0 }, essenceSpent: 0 }
    const result = applySpendEssence(player, 'idle')
    expect(result).toBe(player) // same reference
    expect(result.essence).toBe(0)
  })

  it('returns original player unchanged when branch is at max', () => {
    const player = {
      essence: 9999,
      talents: { idle: TALENT_MAX, gacha: 0, power: 0 },
      essenceSpent: 0,
    }
    const result = applySpendEssence(player, 'idle')
    expect(result).toBe(player) // same reference
    expect(result.talents.idle).toBe(TALENT_MAX)
  })

  it('does not mutate the input player object', () => {
    const talents = { idle: 0, gacha: 0, power: 0 }
    const player = { essence: 10, talents, essenceSpent: 0 }
    applySpendEssence(player, 'idle')
    expect(player.essence).toBe(10)    // unchanged
    expect(player.talents.idle).toBe(0) // unchanged
    expect(player.essenceSpent).toBe(0) // unchanged
  })

  it('handles the 10th point correctly (cost = 10, reaching TALENT_MAX)', () => {
    const player = {
      essence: 10,
      talents: { idle: 9, gacha: 0, power: 0 },
      essenceSpent: 45,
    }
    const updated = applySpendEssence(player, 'idle')
    expect(updated.talents.idle).toBe(10) // at TALENT_MAX
    expect(updated.essence).toBe(0)       // 10 - 10
    expect(updated.essenceSpent).toBe(55) // 45 + 10
  })

  it('handles missing essenceSpent gracefully (defaults to 0)', () => {
    const player = { essence: 10, talents: { idle: 0, gacha: 0, power: 0 } }
    const updated = applySpendEssence(player, 'idle')
    expect(updated.essenceSpent).toBe(1)
  })

  it('handles missing essence gracefully (defaults to 0, which fails canSpendEssence)', () => {
    const player = { talents: { idle: 0, gacha: 0, power: 0 }, essenceSpent: 0 }
    // essence defaults to 0, cost is 1 → cannot spend
    const result = applySpendEssence(player, 'idle')
    expect(result).toBe(player) // unchanged
  })
})
