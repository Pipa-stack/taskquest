import { describe, it, expect } from 'vitest'
import { getStage, canEvolve, evolveCost, evolve } from '../../domain/evolution.js'

// ---------------------------------------------------------------------------
// getStage
// ---------------------------------------------------------------------------
describe('getStage', () => {
  it('returns 1 when character has no entry in characterStages', () => {
    const player = { characterStages: {} }
    expect(getStage('guerrero_novato', player)).toBe(1)
  })

  it('returns 1 when characterStages is undefined', () => {
    const player = {}
    expect(getStage('guerrero_novato', player)).toBe(1)
  })

  it('returns the stored stage when present', () => {
    const player = { characterStages: { guerrero_novato: 2 } }
    expect(getStage('guerrero_novato', player)).toBe(2)
  })

  it('returns 3 for a fully evolved character', () => {
    const player = { characterStages: { oraculo_eterno: 3 } }
    expect(getStage('oraculo_eterno', player)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// canEvolve
// ---------------------------------------------------------------------------
describe('canEvolve', () => {
  it('returns true when character is at Stage 1', () => {
    const player = { characterStages: {} }
    expect(canEvolve('guerrero_novato', player)).toBe(true)
  })

  it('returns true when character is at Stage 2', () => {
    const player = { characterStages: { guerrero_novato: 2 } }
    expect(canEvolve('guerrero_novato', player)).toBe(true)
  })

  it('returns false when character is at Stage 3', () => {
    const player = { characterStages: { guerrero_novato: 3 } }
    expect(canEvolve('guerrero_novato', player)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evolveCost
// ---------------------------------------------------------------------------
describe('evolveCost', () => {
  it('returns correct stage 1→2 cost for common rarity', () => {
    const player = { characterStages: {} }
    expect(evolveCost('guerrero_novato', 'common', player)).toBe(120)
  })

  it('returns correct stage 2→3 cost for common rarity', () => {
    const player = { characterStages: { guerrero_novato: 2 } }
    expect(evolveCost('guerrero_novato', 'common', player)).toBe(300)
  })

  it('returns correct stage 1→2 cost for rare rarity', () => {
    const player = { characterStages: {} }
    expect(evolveCost('cazadora_sombras', 'rare', player)).toBe(180)
  })

  it('returns correct stage 2→3 cost for rare rarity', () => {
    const player = { characterStages: { cazadora_sombras: 2 } }
    expect(evolveCost('cazadora_sombras', 'rare', player)).toBe(450)
  })

  it('returns correct stage 1→2 cost for epic rarity', () => {
    const player = { characterStages: {} }
    expect(evolveCost('dragon_guardian', 'epic', player)).toBe(260)
  })

  it('returns correct stage 2→3 cost for epic rarity', () => {
    const player = { characterStages: { dragon_guardian: 2 } }
    expect(evolveCost('dragon_guardian', 'epic', player)).toBe(650)
  })

  it('returns correct stage 1→2 cost for legendary rarity', () => {
    const player = { characterStages: {} }
    expect(evolveCost('oraculo_eterno', 'legendary', player)).toBe(400)
  })

  it('returns correct stage 2→3 cost for legendary rarity', () => {
    const player = { characterStages: { oraculo_eterno: 2 } }
    expect(evolveCost('oraculo_eterno', 'legendary', player)).toBe(1000)
  })

  it('returns null when character is already at Stage 3', () => {
    const player = { characterStages: { guerrero_novato: 3 } }
    expect(evolveCost('guerrero_novato', 'common', player)).toBeNull()
  })

  it('returns null for unknown rarity', () => {
    const player = { characterStages: {} }
    expect(evolveCost('unknown', 'mythic', player)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// evolve
// ---------------------------------------------------------------------------
describe('evolve', () => {
  it('advances character from Stage 1 to Stage 2', () => {
    const player = { characterStages: {} }
    const updated = evolve('guerrero_novato', player)
    expect(updated.characterStages.guerrero_novato).toBe(2)
  })

  it('advances character from Stage 2 to Stage 3', () => {
    const player = { characterStages: { guerrero_novato: 2 } }
    const updated = evolve('guerrero_novato', player)
    expect(updated.characterStages.guerrero_novato).toBe(3)
  })

  it('does NOT modify player when character is already at Stage 3', () => {
    const player = { characterStages: { guerrero_novato: 3 } }
    const updated = evolve('guerrero_novato', player)
    expect(updated).toBe(player) // exact same reference
    expect(updated.characterStages.guerrero_novato).toBe(3)
  })

  it('does not mutate the original player object', () => {
    const player = { characterStages: { guerrero_novato: 1 } }
    const original = { ...player, characterStages: { ...player.characterStages } }
    evolve('guerrero_novato', player)
    expect(player.characterStages.guerrero_novato).toBe(original.characterStages.guerrero_novato)
  })

  it('preserves other character stages', () => {
    const player = { characterStages: { guerrero_novato: 1, oraculo_eterno: 2 } }
    const updated = evolve('guerrero_novato', player)
    expect(updated.characterStages.guerrero_novato).toBe(2)
    expect(updated.characterStages.oraculo_eterno).toBe(2)
  })

  it('works when characterStages is undefined on player', () => {
    const player = {}
    const updated = evolve('guerrero_novato', player)
    expect(updated.characterStages.guerrero_novato).toBe(2)
  })
})
