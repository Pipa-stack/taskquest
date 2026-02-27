import { describe, it, expect } from 'vitest'
import {
  TALENT_MAX,
  MILESTONE_THRESHOLDS,
  costForNextPoint,
  totalCost,
  milestonesReached,
  computeTalentBonuses,
  computeTalentMilestones,
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

// ── milestonesReached ─────────────────────────────────────────────────────────

describe('milestonesReached', () => {
  it('returns 0 for level 0', () => {
    expect(milestonesReached(0)).toBe(0)
  })

  it('returns 0 for level 2 (first threshold is 3)', () => {
    expect(milestonesReached(2)).toBe(0)
  })

  it('returns 1 for level 3', () => {
    expect(milestonesReached(3)).toBe(1)
  })

  it('returns 1 for level 5 (only threshold 3 reached)', () => {
    expect(milestonesReached(5)).toBe(1)
  })

  it('returns 2 for level 6', () => {
    expect(milestonesReached(6)).toBe(2)
  })

  it('returns 2 for level 9 (thresholds 3 and 6 reached)', () => {
    expect(milestonesReached(9)).toBe(2)
  })

  it('returns 3 for level 10 (all thresholds reached)', () => {
    expect(milestonesReached(10)).toBe(3)
  })

  it('MILESTONE_THRESHOLDS are [3, 6, 10]', () => {
    expect(MILESTONE_THRESHOLDS).toEqual([3, 6, 10])
  })
})

// ── computeTalentBonuses ──────────────────────────────────────────────────────

describe('computeTalentBonuses', () => {
  it('returns baseline values when all branches are 0', () => {
    const bonuses = computeTalentBonuses({ idle: 0, gacha: 0, power: 0 })
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
    expect(bonuses.energyCapBonus).toBe(0)
    expect(bonuses.energyRegenPerMin).toBeCloseTo(0)
    expect(bonuses.gachaRareBonus).toBeCloseTo(0)
    expect(bonuses.pityReduction).toBe(0)
    expect(bonuses.powerMult).toBeCloseTo(1.0)
    expect(bonuses.evolveDiscount).toBeCloseTo(0)
    expect(bonuses.boostDurationMult).toBeCloseTo(1.0)
    expect(bonuses.idleMilestones).toBe(0)
    expect(bonuses.gachaMilestones).toBe(0)
    expect(bonuses.powerMilestones).toBe(0)
  })

  it('handles undefined/null talents gracefully', () => {
    const bonuses = computeTalentBonuses(undefined)
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
    expect(bonuses.energyCapBonus).toBe(0)
    expect(bonuses.energyRegenPerMin).toBeCloseTo(0)
    expect(bonuses.boostDurationMult).toBeCloseTo(1.0)
  })

  it('handles empty object talents gracefully', () => {
    const bonuses = computeTalentBonuses({})
    expect(bonuses.idleCoinMult).toBeCloseTo(1.0)
    expect(bonuses.boostDurationMult).toBeCloseTo(1.0)
  })

  // ── Idle branch ─────────────────────────────────────────────────

  it('idle=1: idleCoinMult = 1.10, energyCapBonus = 10, energyRegenPerMin = 0.5', () => {
    const b = computeTalentBonuses({ idle: 1, gacha: 0, power: 0 })
    expect(b.idleCoinMult).toBeCloseTo(1.10)
    expect(b.energyCapBonus).toBe(10)
    expect(b.energyRegenPerMin).toBeCloseTo(0.5)
  })

  it('idle=2: idleCoinMult = 1.20, energyCapBonus = 20, no milestone', () => {
    const b = computeTalentBonuses({ idle: 2, gacha: 0, power: 0 })
    expect(b.idleCoinMult).toBeCloseTo(1.20)
    expect(b.energyCapBonus).toBe(20)
    expect(b.idleMilestones).toBe(0)
  })

  it('idle=3: first milestone — idleCoinMult = 1.31, energyCapBonus = 30, energyRegenPerMin = 1.5', () => {
    const b = computeTalentBonuses({ idle: 3, gacha: 0, power: 0 })
    // 1 + 3*0.10 + 1*0.01 = 1.31
    expect(b.idleCoinMult).toBeCloseTo(1.31)
    expect(b.energyCapBonus).toBe(30)
    expect(b.energyRegenPerMin).toBeCloseTo(1.5)
    expect(b.idleMilestones).toBe(1)
  })

  it('idle=6: second milestone — idleCoinMult = 1.62, energyCapBonus = 60, energyRegenPerMin = 3.0', () => {
    const b = computeTalentBonuses({ idle: 6, gacha: 0, power: 0 })
    // 1 + 6*0.10 + 2*0.01 = 1.62
    expect(b.idleCoinMult).toBeCloseTo(1.62)
    expect(b.energyCapBonus).toBe(60)
    expect(b.energyRegenPerMin).toBeCloseTo(3.0)
    expect(b.idleMilestones).toBe(2)
  })

  it('idle=10 (max): all milestones — idleCoinMult = 2.03, energyCapBonus = 100, energyRegenPerMin = 5.0', () => {
    const b = computeTalentBonuses({ idle: 10, gacha: 0, power: 0 })
    // 1 + 10*0.10 + 3*0.01 = 2.03
    expect(b.idleCoinMult).toBeCloseTo(2.03)
    expect(b.energyCapBonus).toBe(100)
    expect(b.energyRegenPerMin).toBeCloseTo(5.0)
    expect(b.idleMilestones).toBe(3)
  })

  // ── Gacha branch ─────────────────────────────────────────────────

  it('gacha=1: gachaRareBonus = 0.01, pityReduction = 0, no milestone', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 1, power: 0 })
    expect(b.gachaRareBonus).toBeCloseTo(0.01)
    expect(b.pityReduction).toBe(0)
    expect(b.gachaMilestones).toBe(0)
  })

  it('gacha=2: gachaRareBonus = 0.02, pityReduction = 1', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 2, power: 0 })
    expect(b.gachaRareBonus).toBeCloseTo(0.02)
    expect(b.pityReduction).toBe(1)
  })

  it('gacha=3: first milestone — pityReduction = floor(3/2)+1 = 2', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 3, power: 0 })
    expect(b.gachaRareBonus).toBeCloseTo(0.03)
    // floor(3/2)=1, gachaMilestones=1 → pityReduction=2
    expect(b.pityReduction).toBe(2)
    expect(b.gachaMilestones).toBe(1)
  })

  it('gacha=6: second milestone — pityReduction = floor(6/2)+2 = 5', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 6, power: 0 })
    // floor(6/2)=3, gachaMilestones=2 → pityReduction=5
    expect(b.pityReduction).toBe(5)
    expect(b.gachaMilestones).toBe(2)
  })

  it('gacha=10 (max): all milestones — pityReduction = floor(10/2)+3 = 8', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 10, power: 0 })
    expect(b.gachaRareBonus).toBeCloseTo(0.10)
    // floor(10/2)=5, gachaMilestones=3 → pityReduction=8
    expect(b.pityReduction).toBe(8)
    expect(b.gachaMilestones).toBe(3)
  })

  // ── Power branch ─────────────────────────────────────────────────

  it('power=1: boostDurationMult = 1.05', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 0, power: 1 })
    expect(b.boostDurationMult).toBeCloseTo(1.05)
    expect(b.powerMilestones).toBe(0)
  })

  it('power=3: powerMult = 1.12, evolveDiscount = 0.05, boostDurationMult = 1.15, first milestone', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 0, power: 3 })
    expect(b.powerMult).toBeCloseTo(1.12)
    expect(b.evolveDiscount).toBeCloseTo(0.05)
    expect(b.boostDurationMult).toBeCloseTo(1.15)
    expect(b.powerMilestones).toBe(1)
  })

  it('power=6: powerMult = 1.24, evolveDiscount = 0.10, boostDurationMult = 1.30', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 0, power: 6 })
    expect(b.powerMult).toBeCloseTo(1.24)
    expect(b.evolveDiscount).toBeCloseTo(0.10)
    expect(b.boostDurationMult).toBeCloseTo(1.30)
    expect(b.powerMilestones).toBe(2)
  })

  it('power=10 (max): powerMult=1.40, evolveDiscount=0.15, boostDurationMult=1.50, all milestones', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 0, power: 10 })
    expect(b.powerMult).toBeCloseTo(1.40)
    // floor(10/3)=3, 3*0.05=0.15 (below 0.40 cap)
    expect(b.evolveDiscount).toBeCloseTo(0.15)
    expect(b.boostDurationMult).toBeCloseTo(1.50)
    expect(b.powerMilestones).toBe(3)
  })

  it('evolveDiscount is capped at 0.40 even if formula exceeds it', () => {
    const b = computeTalentBonuses({ idle: 0, gacha: 0, power: 27 })
    expect(b.evolveDiscount).toBeCloseTo(0.40)
  })

  // ── Cross-branch interactions ─────────────────────────────────────

  it('power milestones add +10 to energyCapBonus per milestone', () => {
    // power=3 → powerMilestones=1, adds +10 to energyCap
    // idle=5 → energyCapBonus = 5*10 + 1*10 = 60
    const b = computeTalentBonuses({ idle: 5, gacha: 0, power: 3 })
    expect(b.energyCapBonus).toBe(60)
  })

  it('power=6 adds two milestone bonuses (+20) to energyCapBonus', () => {
    // idle=2 → 2*10=20; powerMilestones=2 → +20; total=40
    const b = computeTalentBonuses({ idle: 2, gacha: 0, power: 6 })
    expect(b.energyCapBonus).toBe(40)
  })

  it('all branches at max: milestone counts all 3', () => {
    const b = computeTalentBonuses({ idle: 10, gacha: 10, power: 10 })
    expect(b.idleMilestones).toBe(3)
    expect(b.gachaMilestones).toBe(3)
    expect(b.powerMilestones).toBe(3)
    // idleCoinMult: 1 + 10*0.10 + 3*0.01 = 2.03
    expect(b.idleCoinMult).toBeCloseTo(2.03)
    // energyCapBonus: 10*10 + 3*10 = 130
    expect(b.energyCapBonus).toBe(130)
    // boostDurationMult: 1 + 10*0.05 = 1.50
    expect(b.boostDurationMult).toBeCloseTo(1.50)
  })
})

// ── computeTalentMilestones ───────────────────────────────────────────────────

describe('computeTalentMilestones', () => {
  it('returns all unreached for all-zero talents', () => {
    const m = computeTalentMilestones({ idle: 0, gacha: 0, power: 0 })
    expect(m.idle.every((x) => !x.reached)).toBe(true)
    expect(m.gacha.every((x) => !x.reached)).toBe(true)
    expect(m.power.every((x) => !x.reached)).toBe(true)
  })

  it('idle=3: first milestone reached, rest not', () => {
    const m = computeTalentMilestones({ idle: 3, gacha: 0, power: 0 })
    expect(m.idle[0]).toEqual({ threshold: 3, reached: true })
    expect(m.idle[1]).toEqual({ threshold: 6, reached: false })
    expect(m.idle[2]).toEqual({ threshold: 10, reached: false })
  })

  it('gacha=10: all milestones reached', () => {
    const m = computeTalentMilestones({ idle: 0, gacha: 10, power: 0 })
    expect(m.gacha.every((x) => x.reached)).toBe(true)
  })

  it('handles undefined gracefully', () => {
    const m = computeTalentMilestones(undefined)
    expect(m.idle.length).toBe(3)
    expect(m.idle.every((x) => !x.reached)).toBe(true)
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

  it('buying 3rd idle point triggers first milestone (idleMilestones=1) in resulting bonuses', () => {
    const player = { essence: 10, talents: { idle: 2, gacha: 0, power: 0 }, essenceSpent: 0 }
    const updated = applySpendEssence(player, 'idle')
    expect(updated.talents.idle).toBe(3)
    // After upgrade, computeTalentBonuses should show first milestone
    const bonuses = computeTalentBonuses(updated.talents)
    expect(bonuses.idleMilestones).toBe(1)
    expect(bonuses.idleCoinMult).toBeCloseTo(1.31)
  })
})
