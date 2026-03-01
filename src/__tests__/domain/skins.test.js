import { describe, it, expect } from 'vitest'
import { SKINS, SKIN_PRICES, getSkin } from '../../domain/skins.js'

describe('SKINS catalog', () => {
  it('has exactly 12 skins', () => {
    expect(SKINS).toHaveLength(12)
  })

  it('every skin has required fields: id, title, rarity, priceCoins, tags', () => {
    for (const skin of SKINS) {
      expect(skin.id).toBeTruthy()
      expect(skin.title).toBeTruthy()
      expect(['common', 'rare', 'epic']).toContain(skin.rarity)
      expect(typeof skin.priceCoins).toBe('number')
      expect(skin.priceCoins).toBeGreaterThan(0)
      expect(Array.isArray(skin.tags)).toBe(true)
    }
  })

  it('common skins cost 40 coins', () => {
    const commons = SKINS.filter((s) => s.rarity === 'common')
    expect(commons.length).toBeGreaterThan(0)
    for (const s of commons) {
      expect(s.priceCoins).toBe(SKIN_PRICES.common)
      expect(s.priceCoins).toBe(40)
    }
  })

  it('rare skins cost 80 coins', () => {
    const rares = SKINS.filter((s) => s.rarity === 'rare')
    expect(rares.length).toBeGreaterThan(0)
    for (const s of rares) {
      expect(s.priceCoins).toBe(SKIN_PRICES.rare)
      expect(s.priceCoins).toBe(80)
    }
  })

  it('epic skins cost 120 coins', () => {
    const epics = SKINS.filter((s) => s.rarity === 'epic')
    expect(epics.length).toBeGreaterThan(0)
    for (const s of epics) {
      expect(s.priceCoins).toBe(SKIN_PRICES.epic)
      expect(s.priceCoins).toBe(120)
    }
  })

  it('has 4 common, 4 rare and 4 epic skins', () => {
    const byRarity = (r) => SKINS.filter((s) => s.rarity === r).length
    expect(byRarity('common')).toBe(4)
    expect(byRarity('rare')).toBe(4)
    expect(byRarity('epic')).toBe(4)
  })

  it('all skin ids are unique', () => {
    const ids = SKINS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getSkin', () => {
  it('returns the skin definition for a known id', () => {
    const skin = getSkin('skin_autumn')
    expect(skin).toBeDefined()
    expect(skin.title).toBe('Otoño Dorado')
    expect(skin.rarity).toBe('common')
    expect(skin.priceCoins).toBe(40)
  })

  it('returns undefined for an unknown id', () => {
    expect(getSkin('nonexistent')).toBeUndefined()
    expect(getSkin('')).toBeUndefined()
    expect(getSkin(null)).toBeUndefined()
  })

  it('returns the skin definition for an epic skin', () => {
    const skin = getSkin('skin_celestial')
    expect(skin).toBeDefined()
    expect(skin.rarity).toBe('epic')
    expect(skin.priceCoins).toBe(120)
  })
})
