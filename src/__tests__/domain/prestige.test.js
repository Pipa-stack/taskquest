import { describe, it, expect } from 'vitest'
import {
  canPrestige,
  computeEssenceGain,
  computeGlobalMultiplier,
  applyPrestige,
  PRESTIGE_REQUIRED_ZONE,
  PRESTIGE_REQUIRED_POWER,
} from '../../domain/prestige.js'

// ---------------------------------------------------------------------------
// canPrestige
// ---------------------------------------------------------------------------
describe('canPrestige', () => {
  const basePlayer = {
    currentZone: 6,
    zoneUnlockedMax: 6,
    coins: 1000,
  }

  it('returns true when zone >= 6 and power >= 250', () => {
    expect(canPrestige(basePlayer, 250, 6)).toBe(true)
    expect(canPrestige(basePlayer, 300, 6)).toBe(true)
    expect(canPrestige(basePlayer, 500, 6)).toBe(true)
  })

  it('returns false when zone < 6', () => {
    expect(canPrestige(basePlayer, 300, 5)).toBe(false)
    expect(canPrestige(basePlayer, 300, 1)).toBe(false)
  })

  it('returns false when power < 250', () => {
    expect(canPrestige(basePlayer, 249, 6)).toBe(false)
    expect(canPrestige(basePlayer, 0, 6)).toBe(false)
  })

  it('returns false when both zone and power are insufficient', () => {
    expect(canPrestige(basePlayer, 100, 3)).toBe(false)
  })

  it('returns false when player is null or undefined', () => {
    expect(canPrestige(null, 300, 6)).toBe(false)
    expect(canPrestige(undefined, 300, 6)).toBe(false)
  })

  it('falls back to player.currentZone when currentZone param is not provided', () => {
    // Pass undefined as currentZone — should use player.currentZone (6)
    expect(canPrestige({ currentZone: 6 }, 250, undefined)).toBe(true)
    expect(canPrestige({ currentZone: 5 }, 250, undefined)).toBe(false)
  })

  it('uses PRESTIGE_REQUIRED_ZONE and PRESTIGE_REQUIRED_POWER constants', () => {
    expect(PRESTIGE_REQUIRED_ZONE).toBe(6)
    expect(PRESTIGE_REQUIRED_POWER).toBe(250)
  })

  it('boundary: exactly zone 6 and exactly power 250 is eligible', () => {
    expect(canPrestige(basePlayer, PRESTIGE_REQUIRED_POWER, PRESTIGE_REQUIRED_ZONE)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeEssenceGain
// ---------------------------------------------------------------------------
describe('computeEssenceGain', () => {
  it('returns floor(powerScore / 50)', () => {
    expect(computeEssenceGain(50)).toBe(1)
    expect(computeEssenceGain(100)).toBe(2)
    expect(computeEssenceGain(250)).toBe(5)
    expect(computeEssenceGain(300)).toBe(6)
    expect(computeEssenceGain(499)).toBe(9)
    expect(computeEssenceGain(500)).toBe(10)
  })

  it('floors the result (no fractional essence)', () => {
    expect(computeEssenceGain(51)).toBe(1)
    expect(computeEssenceGain(99)).toBe(1)
    expect(computeEssenceGain(149)).toBe(2)
  })

  it('returns 0 for power score of 0 or below 50', () => {
    expect(computeEssenceGain(0)).toBe(0)
    expect(computeEssenceGain(49)).toBe(0)
  })

  it('handles null/undefined by treating as 0', () => {
    expect(computeEssenceGain(null)).toBe(0)
    expect(computeEssenceGain(undefined)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeGlobalMultiplier
// ---------------------------------------------------------------------------
describe('computeGlobalMultiplier', () => {
  it('returns 1.0 for 0 essence (no bonus)', () => {
    expect(computeGlobalMultiplier(0)).toBe(1)
  })

  it('applies +2% per essence point', () => {
    expect(computeGlobalMultiplier(1)).toBeCloseTo(1.02)
    expect(computeGlobalMultiplier(5)).toBeCloseTo(1.10)
    expect(computeGlobalMultiplier(10)).toBeCloseTo(1.20)
    expect(computeGlobalMultiplier(50)).toBeCloseTo(2.00)
  })

  it('formula is 1 + essence × 0.02', () => {
    for (const e of [0, 1, 3, 7, 25, 100]) {
      expect(computeGlobalMultiplier(e)).toBeCloseTo(1 + e * 0.02)
    }
  })

  it('never returns less than 1.0', () => {
    expect(computeGlobalMultiplier(0)).toBeGreaterThanOrEqual(1)
  })

  it('handles null/undefined by treating as 0', () => {
    expect(computeGlobalMultiplier(null)).toBe(1)
    expect(computeGlobalMultiplier(undefined)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// applyPrestige
// ---------------------------------------------------------------------------
describe('applyPrestige', () => {
  const basePlayer = {
    id: 1,
    xp: 5000,
    streak: 10,
    coins: 999,
    energy: 50,
    energyCap: 100,
    coinsPerMinuteBase: 5,
    currentZone: 6,
    zoneUnlockedMax: 6,
    zoneProgress: { 1: { claimedRewards: ['z1_q1'] } },
    essence: 0,
    prestigeCount: 0,
    globalMultiplierCache: 1,
    unlockedCharacters: ['warrior', 'mage'],
    activeTeam: ['warrior'],
    rewardsUnlocked: ['r1'],
    dailyGoal: 5,
  }

  it('resets coins to 0', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.coins).toBe(0)
  })

  it('resets currentZone to 1', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.currentZone).toBe(1)
  })

  it('resets zoneUnlockedMax to 1', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.zoneUnlockedMax).toBe(1)
  })

  it('resets zoneProgress to {}', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.zoneProgress).toEqual({})
  })

  it('resets coinsPerMinuteBase to 1', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.coinsPerMinuteBase).toBe(1)
  })

  it('refills energy to energyCap', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.energy).toBe(basePlayer.energyCap)
  })

  it('increments prestigeCount by 1', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.prestigeCount).toBe(1)
  })

  it('adds essenceGain to essence', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.essence).toBe(5)
  })

  it('accumulates essence across multiple prestiges', () => {
    const player10 = { ...basePlayer, essence: 10, prestigeCount: 2 }
    const result = applyPrestige(player10, 3)
    expect(result.essence).toBe(13)
    expect(result.prestigeCount).toBe(3)
  })

  it('updates globalMultiplierCache to 1 + newEssence × 0.02', () => {
    const result = applyPrestige(basePlayer, 5) // essence goes from 0 to 5
    expect(result.globalMultiplierCache).toBeCloseTo(1 + 5 * 0.02)
  })

  it('globalMultiplierCache reflects cumulative essence (not just gain)', () => {
    const player5 = { ...basePlayer, essence: 5 }
    const result = applyPrestige(player5, 3) // 5 + 3 = 8 essence
    expect(result.globalMultiplierCache).toBeCloseTo(1 + 8 * 0.02)
  })

  it('does NOT reset xp', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.xp).toBe(5000)
  })

  it('does NOT reset streak', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.streak).toBe(10)
  })

  it('does NOT reset unlockedCharacters', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.unlockedCharacters).toEqual(['warrior', 'mage'])
  })

  it('does NOT reset activeTeam', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.activeTeam).toEqual(['warrior'])
  })

  it('does NOT reset rewardsUnlocked', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.rewardsUnlocked).toEqual(['r1'])
  })

  it('does NOT reset dailyGoal', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.dailyGoal).toBe(5)
  })

  it('does NOT reset energyCap', () => {
    const result = applyPrestige(basePlayer, 5)
    expect(result.energyCap).toBe(100)
  })

  it('does not mutate the original player object', () => {
    const original = { ...basePlayer }
    applyPrestige(basePlayer, 5)
    // Original should be unchanged
    expect(basePlayer.coins).toBe(original.coins)
    expect(basePlayer.currentZone).toBe(original.currentZone)
    expect(basePlayer.prestigeCount).toBe(original.prestigeCount)
    expect(basePlayer.essence).toBe(original.essence)
  })

  it('handles missing essence/prestigeCount by defaulting to 0', () => {
    const playerNoPrestige = {
      ...basePlayer,
      essence: undefined,
      prestigeCount: undefined,
    }
    const result = applyPrestige(playerNoPrestige, 3)
    expect(result.essence).toBe(3)
    expect(result.prestigeCount).toBe(1)
  })

  it('handles missing energyCap by defaulting energy to 100', () => {
    const playerNoCap = { ...basePlayer, energyCap: undefined }
    const result = applyPrestige(playerNoCap, 3)
    expect(result.energy).toBe(100)
  })
})
