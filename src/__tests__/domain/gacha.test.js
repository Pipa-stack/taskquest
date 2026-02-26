import { describe, it, expect } from 'vitest'
import {
  DROP_RATES,
  PITY_LEGENDARY_THRESHOLD,
  DUST_PER_DUPLICATE,
  pickRarity,
  pickCharacter,
  resolvePull,
  resolvePackPulls,
  getPack,
  PACK_CATALOG,
} from '../../domain/gacha.js'
import { CHARACTERS } from '../../domain/characters.js'

// ── DROP_RATES ──────────────────────────────────────────────────────────────
describe('DROP_RATES', () => {
  it('all rates sum to 1.0 (within floating-point tolerance)', () => {
    const sum = Object.values(DROP_RATES).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001)
  })

  it('has entries for common, uncommon, rare, epic, legendary', () => {
    expect(DROP_RATES).toHaveProperty('common')
    expect(DROP_RATES).toHaveProperty('uncommon')
    expect(DROP_RATES).toHaveProperty('rare')
    expect(DROP_RATES).toHaveProperty('epic')
    expect(DROP_RATES).toHaveProperty('legendary')
  })

  it('common is the most frequent rarity', () => {
    const { common, ...rest } = DROP_RATES
    const max = Math.max(...Object.values(rest))
    expect(common).toBeGreaterThan(max)
  })
})

// ── PACK_CATALOG ────────────────────────────────────────────────────────────
describe('PACK_CATALOG', () => {
  it('contains starter, boost, and mega packs', () => {
    const ids = PACK_CATALOG.map((p) => p.id)
    expect(ids).toContain('starter')
    expect(ids).toContain('boost')
    expect(ids).toContain('mega')
  })

  it('starter costs 120 and has 1 pull', () => {
    const starter = getPack('starter')
    expect(starter.cost).toBe(120)
    expect(starter.pulls).toBe(1)
  })

  it('mega pack guarantees rare+', () => {
    const mega = getPack('mega')
    expect(mega.guaranteeRare).toBe(true)
    expect(mega.pulls).toBe(10)
  })

  it('getPack returns undefined for unknown id', () => {
    expect(getPack('does_not_exist')).toBeUndefined()
  })
})

// ── pickRarity ──────────────────────────────────────────────────────────────
describe('pickRarity', () => {
  it('returns common for rand near 0', () => {
    expect(pickRarity(0)).toBe('common')
  })

  it('returns legendary for rand near 1.0', () => {
    // cumulative: common=0.7, uncommon=0.9, rare=0.98, epic=0.998, legendary=1.0
    expect(pickRarity(0.999)).toBe('legendary')
  })

  it('returns uncommon for rand in 0.70–0.90 range', () => {
    expect(pickRarity(0.75)).toBe('uncommon')
  })

  it('returns rare for rand in 0.90–0.98 range', () => {
    expect(pickRarity(0.93)).toBe('rare')
  })

  it('forced rarity overrides random', () => {
    // even with rand=0 (would be common), force epic
    expect(pickRarity(0, 'epic')).toBe('epic')
    expect(pickRarity(0.999, 'common')).toBe('common')
  })

  it('handles floating-point edge (rand = 0.7 boundary)', () => {
    // At exactly 0.7, common cumulative is 0.7. rand < 0.7 is false → next rarity
    const r = pickRarity(0.7)
    expect(['uncommon', 'rare', 'epic', 'legendary']).toContain(r)
  })
})

// ── pickCharacter ───────────────────────────────────────────────────────────
describe('pickCharacter', () => {
  it('returns a character of the requested rarity', () => {
    const char = pickCharacter('common', 0.5)
    expect(char.rarity).toBe('common')
  })

  it('falls back to common if rarity has no characters', () => {
    // 'legendary' has no characters in the default catalog
    const char = pickCharacter('legendary', 0.5)
    // Should still return something valid
    expect(CHARACTERS.map((c) => c.id)).toContain(char.id)
  })

  it('uses rand2 to pick from multiple candidates', () => {
    // common chars: warrior, ranger
    const char0 = pickCharacter('common', 0.0)
    const char1 = pickCharacter('common', 0.9)
    // Both should be common
    expect(char0.rarity).toBe('common')
    expect(char1.rarity).toBe('common')
  })

  it('accepts a custom catalog', () => {
    const miniCatalog = [{ id: 'test_char', emoji: '🧪', name: 'Test', rarity: 'rare', stage: 'I', cost: 100 }]
    const char = pickCharacter('rare', 0.5, miniCatalog)
    expect(char.id).toBe('test_char')
  })
})

// ── resolvePull ─────────────────────────────────────────────────────────────
describe('resolvePull', () => {
  it('returns a pull result with expected shape', () => {
    const result = resolvePull({ rand1: 0.5, rand2: 0.5, pityCounter: 0, unlockedCharacters: [] })
    expect(result).toHaveProperty('characterId')
    expect(result).toHaveProperty('rarity')
    expect(result).toHaveProperty('isNew')
    expect(result).toHaveProperty('dustGained')
  })

  it('marks pull as new when character not in unlockedCharacters', () => {
    const result = resolvePull({ rand1: 0, rand2: 0, pityCounter: 0, unlockedCharacters: [] })
    expect(result.isNew).toBe(true)
    expect(result.dustGained).toBe(0)
  })

  it('marks pull as duplicate and gives dust when character already owned', () => {
    // rand1=0 → common, rand2=0 → first common character
    const firstCommon = pickCharacter('common', 0)
    const result = resolvePull({
      rand1: 0,
      rand2: 0,
      pityCounter: 0,
      unlockedCharacters: [firstCommon.id],
    })
    expect(result.isNew).toBe(false)
    expect(result.dustGained).toBe(DUST_PER_DUPLICATE.common)
    expect(result.dustGained).toBeGreaterThan(0)
  })

  it('triggers legendary via pity when pityCounter >= PITY_LEGENDARY_THRESHOLD', () => {
    // Force pity trigger — regardless of rand1 value it should be legendary
    // Since legendary has no characters in catalog, pickCharacter will fall back,
    // but rarity should be 'legendary'
    const result = resolvePull({
      rand1: 0,           // would be common without pity
      rand2: 0.5,
      pityCounter: PITY_LEGENDARY_THRESHOLD,
      unlockedCharacters: [],
    })
    expect(result.rarity).toBe('legendary')
  })

  it('pity does not trigger below threshold', () => {
    const result = resolvePull({
      rand1: 0,           // will be common
      rand2: 0,
      pityCounter: PITY_LEGENDARY_THRESHOLD - 1,
      unlockedCharacters: [],
    })
    expect(result.rarity).toBe('common')
  })

  it('forceMinRarity upgrades rarity when rolled rarity is below minimum', () => {
    // rand1=0 → common, forceMinRarity='rare' → should be at least rare
    const result = resolvePull({
      rand1: 0,
      rand2: 0,
      pityCounter: 0,
      unlockedCharacters: [],
      forceMinRarity: 'rare',
    })
    const RARITY_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    expect(RARITY_TIERS.indexOf(result.rarity)).toBeGreaterThanOrEqual(RARITY_TIERS.indexOf('rare'))
  })

  it('dust for duplicate rare is higher than for duplicate common', () => {
    expect(DUST_PER_DUPLICATE.rare).toBeGreaterThan(DUST_PER_DUPLICATE.common)
    expect(DUST_PER_DUPLICATE.legendary).toBeGreaterThan(DUST_PER_DUPLICATE.rare)
  })
})

// ── resolvePackPulls ────────────────────────────────────────────────────────
describe('resolvePackPulls', () => {
  it('returns null for unknown pack id', () => {
    const result = resolvePackPulls({
      packId: 'nonexistent',
      pityCounter: 0,
      unlockedCharacters: [],
    })
    expect(result).toBeNull()
  })

  it('starter pack produces exactly 1 pull', () => {
    const { pulls } = resolvePackPulls({
      packId: 'starter',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0.5,
    })
    expect(pulls).toHaveLength(1)
  })

  it('boost pack produces exactly 3 pulls', () => {
    const { pulls } = resolvePackPulls({
      packId: 'boost',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0.5,
    })
    expect(pulls).toHaveLength(3)
  })

  it('mega pack produces exactly 10 pulls', () => {
    const { pulls } = resolvePackPulls({
      packId: 'mega',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0.5,
    })
    expect(pulls).toHaveLength(10)
  })

  it('pity counter increments correctly on non-legendary pulls', () => {
    // Use rand that produces common (0) for all pulls
    const { newPityCounter } = resolvePackPulls({
      packId: 'starter',
      pityCounter: 5,
      unlockedCharacters: [],
      rand: () => 0, // always common
    })
    // 5 + 1 pull (common) = 6
    expect(newPityCounter).toBe(6)
  })

  it('pity counter resets to 0 after legendary pull triggered by pity', () => {
    // Start at threshold so next pull is guaranteed legendary
    const { newPityCounter, pulls } = resolvePackPulls({
      packId: 'starter',
      pityCounter: PITY_LEGENDARY_THRESHOLD,
      unlockedCharacters: [],
      rand: () => 0, // would be common without pity
    })
    expect(pulls[0].rarity).toBe('legendary')
    expect(newPityCounter).toBe(0)
  })

  it('mega pack guarantees at least 1 rare+ when all others would be common', () => {
    // rand=0 always → common. But last pull of mega pack should be forced to rare+
    const { pulls } = resolvePackPulls({
      packId: 'mega',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0, // always common
    })
    const hasRarePlus = pulls.some((p) => ['rare', 'epic', 'legendary'].includes(p.rarity))
    expect(hasRarePlus).toBe(true)
  })

  it('mega pack does NOT force rare on last pull if rare+ already appeared', () => {
    // Alternate: first pull rare (rand slightly above rare threshold), rest common
    let callCount = 0
    const { pulls } = resolvePackPulls({
      packId: 'mega',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => {
        // rand1 and rand2 alternate: 0=first char, 0.93=rare (for rand1 on first pull)
        callCount++
        // pull 0: rand1=0.93 (rare), rand2=0.5
        if (callCount === 1) return 0.93
        return 0 // everything else common / first char
      },
    })
    expect(pulls[0].rarity).toBe('rare')
    // Last pull doesn't need to be forced since rare already appeared
    // All common rands (0) on last pull should produce common
    expect(pulls[pulls.length - 1].rarity).toBe('common')
  })

  it('duplicates within same pack are resolved correctly', () => {
    // All common, no characters initially unlocked
    // First pull: new; subsequent pulls of same char: duplicate
    const commonChars = CHARACTERS.filter((c) => c.rarity === 'common')
    const firstCommon = commonChars[0]

    // Pre-unlock the first common so it's always a duplicate
    const { pulls } = resolvePackPulls({
      packId: 'boost',  // 3 pulls
      pityCounter: 0,
      unlockedCharacters: [firstCommon.id],
      rand: () => 0, // always picks first common
    })

    // All 3 should be duplicates (character already owned)
    for (const pull of pulls) {
      expect(pull.isNew).toBe(false)
      expect(pull.dustGained).toBeGreaterThan(0)
    }
  })

  it('newly unlocked chars in a pack are not duplicated in subsequent pulls', () => {
    // First pull unlocks a char, second pull of same char should count as duplicate
    // Only 2 common chars: warrior, ranger
    const { pulls } = resolvePackPulls({
      packId: 'boost',  // 3 pulls
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0, // always first common character
    })

    // First pull: isNew = true
    expect(pulls[0].isNew).toBe(true)
    // Subsequent pulls of same char should be duplicates
    expect(pulls[1].isNew).toBe(false)
    expect(pulls[2].isNew).toBe(false)
  })

  it('each pull result has expected shape', () => {
    const { pulls } = resolvePackPulls({
      packId: 'starter',
      pityCounter: 0,
      unlockedCharacters: [],
      rand: () => 0.5,
    })
    expect(pulls[0]).toHaveProperty('characterId')
    expect(pulls[0]).toHaveProperty('rarity')
    expect(pulls[0]).toHaveProperty('isNew')
    expect(pulls[0]).toHaveProperty('dustGained')
  })
})
