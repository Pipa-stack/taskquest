import { describe, it, expect } from 'vitest'
import { ZONE_CATALOG, getZone, canUnlockZone, applyZoneUnlock } from '../../domain/zones.js'

// ---------------------------------------------------------------------------
// ZONE_CATALOG
// ---------------------------------------------------------------------------
describe('ZONE_CATALOG', () => {
  it('has exactly 6 zones numbered 1 through 6', () => {
    expect(ZONE_CATALOG).toHaveLength(6)
    expect(ZONE_CATALOG.map((z) => z.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('zone 1 has no power requirement and no coin cost', () => {
    const z1 = getZone(1)
    expect(z1.requiredPower).toBe(0)
    expect(z1.unlockCostCoins).toBe(0)
    expect(z1.coinsPerMinuteBonus).toBe(0)
  })

  it('zones have increasing required power', () => {
    for (let i = 1; i < ZONE_CATALOG.length; i++) {
      expect(ZONE_CATALOG[i].requiredPower).toBeGreaterThanOrEqual(ZONE_CATALOG[i - 1].requiredPower)
    }
  })
})

// ---------------------------------------------------------------------------
// getZone
// ---------------------------------------------------------------------------
describe('getZone', () => {
  it('returns the correct zone by id', () => {
    expect(getZone(1)?.name).toBeDefined()
    expect(getZone(6)?.id).toBe(6)
  })

  it('returns undefined for an unknown id', () => {
    expect(getZone(0)).toBeUndefined()
    expect(getZone(7)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// canUnlockZone
// ---------------------------------------------------------------------------
describe('canUnlockZone', () => {
  const basePlayer = {
    zoneUnlockedMax: 1,
    coins: 1000,
  }

  it('returns true when all requirements are met for the next zone', () => {
    const zone2 = getZone(2)
    expect(canUnlockZone(basePlayer, zone2.requiredPower, 2)).toBe(true)
  })

  it('returns false when trying to unlock a zone that is already unlocked', () => {
    expect(canUnlockZone({ ...basePlayer, zoneUnlockedMax: 3 }, 999, 2)).toBe(false)
    expect(canUnlockZone({ ...basePlayer, zoneUnlockedMax: 3 }, 999, 3)).toBe(false)
  })

  it('returns false when trying to skip a zone (non-sequential)', () => {
    // zoneUnlockedMax=1, trying to unlock zone 3
    expect(canUnlockZone(basePlayer, 999, 3)).toBe(false)
  })

  it('returns false when power score is insufficient', () => {
    const zone2 = getZone(2)
    expect(canUnlockZone(basePlayer, zone2.requiredPower - 1, 2)).toBe(false)
  })

  it('returns false when player does not have enough coins', () => {
    const zone2 = getZone(2)
    const poorPlayer = { ...basePlayer, coins: zone2.unlockCostCoins - 1 }
    expect(canUnlockZone(poorPlayer, zone2.requiredPower, 2)).toBe(false)
  })

  it('returns false for an unknown zone id', () => {
    expect(canUnlockZone(basePlayer, 999, 99)).toBe(false)
  })

  it('handles missing zoneUnlockedMax (defaults to 1)', () => {
    const playerNoMax = { coins: 1000 }
    const zone2 = getZone(2)
    expect(canUnlockZone(playerNoMax, zone2.requiredPower, 2)).toBe(true)
  })

  it('handles missing coins (defaults to 0)', () => {
    const zone2 = getZone(2)
    const playerNoCoins = { zoneUnlockedMax: 1 }
    // zone2 costs coins so should fail
    if (zone2.unlockCostCoins > 0) {
      expect(canUnlockZone(playerNoCoins, zone2.requiredPower, 2)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// applyZoneUnlock
// ---------------------------------------------------------------------------
describe('applyZoneUnlock', () => {
  it('deducts coins from player', () => {
    const zone2 = getZone(2)
    const player = { coins: 500, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1 }
    const result = applyZoneUnlock(player, 2)
    expect(result.coins).toBe(500 - zone2.unlockCostCoins)
  })

  it('updates zoneUnlockedMax', () => {
    const player = { coins: 500, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1 }
    const result = applyZoneUnlock(player, 2)
    expect(result.zoneUnlockedMax).toBe(2)
  })

  it('sets currentZone to the newly unlocked zone', () => {
    const player = { coins: 500, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1 }
    const result = applyZoneUnlock(player, 2)
    expect(result.currentZone).toBe(2)
  })

  it('increases coinsPerMinuteBase by the zone bonus', () => {
    const zone2 = getZone(2)
    const player = { coins: 500, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1 }
    const result = applyZoneUnlock(player, 2)
    expect(result.coinsPerMinuteBase).toBe(1 + zone2.coinsPerMinuteBonus)
  })

  it('coins never go below 0 (safety guard)', () => {
    // Give just enough coins (exact cost)
    const zone2 = getZone(2)
    const player = { coins: zone2.unlockCostCoins, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1 }
    const result = applyZoneUnlock(player, 2)
    expect(result.coins).toBe(0)
  })

  it('preserves other player fields', () => {
    const player = { coins: 500, zoneUnlockedMax: 1, currentZone: 1, coinsPerMinuteBase: 1, xp: 1234, streak: 5 }
    const result = applyZoneUnlock(player, 2)
    expect(result.xp).toBe(1234)
    expect(result.streak).toBe(5)
  })
})
