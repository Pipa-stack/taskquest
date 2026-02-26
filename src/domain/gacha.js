/**
 * Gacha / Pack Opening domain logic for TaskQuest.
 *
 * Pure functions — no DB, no React. All randomness injected as `rand` param
 * so callers can make pulls deterministic in tests.
 */

import { CHARACTERS } from './characters.js'

// ── Pack catalog ────────────────────────────────────────────────────────────
export const PACK_CATALOG = [
  { id: 'starter', label: 'Starter Pack', emoji: '🎁', cost: 120, pulls: 1, guaranteeRare: false },
  { id: 'boost',   label: 'Boost Pack',   emoji: '✨', cost: 300, pulls: 3, guaranteeRare: false },
  { id: 'mega',    label: 'Mega Pack',    emoji: '💎', cost: 900, pulls: 10, guaranteeRare: true  },
]

/** Returns a pack definition by id, or undefined. */
export function getPack(id) {
  return PACK_CATALOG.find((p) => p.id === id)
}

// ── Drop rates ──────────────────────────────────────────────────────────────
export const DROP_RATES = {
  common:    0.700,
  uncommon:  0.200,
  rare:      0.080,
  epic:      0.018,
  legendary: 0.002,
}

// Validate at module load
const rateSum = Object.values(DROP_RATES).reduce((a, b) => a + b, 0)
if (Math.abs(rateSum - 1.0) > 0.0001) {
  console.warn('[gacha] DROP_RATES do not sum to 1:', rateSum)
}

// ── Pity system ─────────────────────────────────────────────────────────────
/** After this many non-legendary pulls, the next pull is guaranteed legendary. */
export const PITY_LEGENDARY_THRESHOLD = 30

// ── Dust rewards for duplicates ─────────────────────────────────────────────
export const DUST_PER_DUPLICATE = {
  common:    10,
  uncommon:  20,
  rare:      40,
  epic:      100,
  legendary: 200,
}

// ── Core pull logic ─────────────────────────────────────────────────────────

/**
 * Picks a rarity based on DROP_RATES using a uniform random [0,1) value.
 *
 * @param {number} rand - uniform random in [0, 1)
 * @param {string|null} [forcedRarity] - override rarity (for pity / guaranteed pulls)
 * @returns {'common'|'uncommon'|'rare'|'epic'|'legendary'}
 */
export function pickRarity(rand, forcedRarity = null) {
  if (forcedRarity) return forcedRarity

  let cumulative = 0
  for (const [rarity, rate] of Object.entries(DROP_RATES)) {
    cumulative += rate
    if (rand < cumulative) return rarity
  }
  // Floating-point safety: if rand lands exactly on 1.0
  return 'common'
}

/**
 * Picks a random character of the given rarity from the catalog.
 * Falls back to common if no characters of that rarity exist.
 *
 * @param {string} rarity
 * @param {number} rand2 - second independent random [0, 1) for character selection
 * @param {object[]} [catalog] - character catalog (default: CHARACTERS)
 * @returns {object} character definition
 */
export function pickCharacter(rarity, rand2, catalog = CHARACTERS) {
  let candidates = catalog.filter((c) => c.rarity === rarity)
  if (candidates.length === 0) candidates = catalog.filter((c) => c.rarity === 'common')
  if (candidates.length === 0) return catalog[0] // last-resort fallback
  return candidates[Math.floor(rand2 * candidates.length)]
}

/**
 * Resolves a single gacha pull result.
 *
 * @param {object} opts
 * @param {number}   opts.rand1            - [0,1) for rarity roll
 * @param {number}   opts.rand2            - [0,1) for character selection
 * @param {number}   opts.pityCounter      - pulls since last legendary (pre-this-pull)
 * @param {string[]} opts.unlockedCharacters - already-owned character ids
 * @param {string|null} [opts.forceMinRarity] - minimum rarity to guarantee (for Mega Pack)
 * @param {object[]} [opts.catalog]        - character catalog (default: CHARACTERS)
 * @returns {{ characterId: string, rarity: string, isNew: boolean, dustGained: number }}
 */
export function resolvePull({ rand1, rand2, pityCounter, unlockedCharacters, forceMinRarity = null, catalog = CHARACTERS }) {
  const RARITY_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary']

  // Pity overrides to legendary
  const forcedLegendary = pityCounter >= PITY_LEGENDARY_THRESHOLD

  let rarity
  if (forcedLegendary) {
    rarity = 'legendary'
  } else if (forceMinRarity) {
    const rolled = pickRarity(rand1)
    const rolledTier = RARITY_TIERS.indexOf(rolled)
    const minTier    = RARITY_TIERS.indexOf(forceMinRarity)
    rarity = rolledTier >= minTier ? rolled : forceMinRarity
  } else {
    rarity = pickRarity(rand1)
  }

  const char = pickCharacter(rarity, rand2, catalog)
  const isNew = !unlockedCharacters.includes(char.id)
  const dustGained = isNew ? 0 : (DUST_PER_DUPLICATE[rarity] ?? 10)

  return { characterId: char.id, rarity, isNew, dustGained }
}

/**
 * Resolves a full pack of pulls, applying pity tracking and the Mega Pack
 * "guarantee 1 rare+" rule.
 *
 * @param {object} opts
 * @param {string}   opts.packId             - id from PACK_CATALOG
 * @param {number}   opts.pityCounter        - current pity counter (before this pack)
 * @param {string[]} opts.unlockedCharacters - current unlocked characters (mutated during resolution)
 * @param {Function} [opts.rand]             - () => number, default Math.random (injectable for tests)
 * @param {object[]} [opts.catalog]          - character catalog (default: CHARACTERS)
 * @returns {{ pulls: Array, newPityCounter: number }} or null if pack not found
 */
export function resolvePackPulls({ packId, pityCounter, unlockedCharacters, rand = Math.random, catalog = CHARACTERS }) {
  const pack = getPack(packId)
  if (!pack) return null

  let currentPity = pityCounter
  const owned = [...unlockedCharacters]
  const pulls = []
  let hasRarePlus = false

  for (let i = 0; i < pack.pulls; i++) {
    const isLastPull = i === pack.pulls - 1
    // Mega Pack guarantees at least 1 rare+ across all pulls
    const forceMinRarity = (pack.guaranteeRare && isLastPull && !hasRarePlus) ? 'rare' : null

    const pull = resolvePull({
      rand1: rand(),
      rand2: rand(),
      pityCounter: currentPity,
      unlockedCharacters: owned,
      forceMinRarity,
      catalog,
    })

    // Track pity: legendary resets counter, others increment
    if (pull.rarity === 'legendary') {
      currentPity = 0
    } else {
      currentPity++
    }

    // Track rare+ for Mega Pack guarantee
    if (['rare', 'epic', 'legendary'].includes(pull.rarity)) hasRarePlus = true

    // Track newly unlocked chars so duplicates resolve correctly within same pack
    if (pull.isNew) owned.push(pull.characterId)

    pulls.push(pull)
  }

  return { pulls, newPityCounter: currentPity }
}
