/**
 * Gacha system domain logic for TaskQuest.
 *
 * Handles drop-rate tables, rare-bonus application, and pity threshold.
 * Talent bonuses (from gacha branch) modify both the drop rates and the
 * pity counter.
 *
 * All functions are pure (no side effects, no DB access).
 */

/** Default pity threshold (guaranteed rare+ after this many pulls). */
export const PITY_DEFAULT = 30

/** Minimum pity threshold after talent reductions. */
export const PITY_MIN = 20

/**
 * Base drop rates (must sum to 1.0).
 * Rare bonus from talents adds to the rare tier; rates are re-normalised afterwards.
 */
export const BASE_RATES = {
  common:    0.60,
  uncommon:  0.25,
  rare:      0.10,
  epic:      0.04,
  legendary: 0.01,
}

/**
 * Normalises a rates object so that all values sum to exactly 1.0.
 * Returns a new object; does not mutate the input.
 *
 * @param {{ [rarity: string]: number }} rates
 * @returns {{ [rarity: string]: number }}
 */
export function normalizeRates(rates) {
  const total = Object.values(rates).reduce((sum, v) => sum + v, 0)
  if (total === 0) return { ...rates }
  const result = {}
  for (const [key, val] of Object.entries(rates)) {
    result[key] = val / total
  }
  return result
}

/**
 * Applies a gacha rare bonus to the base drop-rate table.
 *
 * The bonus (from talent: gacha * 0.01) is added directly to the rare tier.
 * The resulting rates are re-normalised so they still sum to 1.0.
 * The common pool naturally absorbs the reduction.
 *
 * Example: gachaRareBonus=0.05 with BASE_RATES:
 *   rare becomes 0.15 before normalisation → normalised to 0.15 / 1.05 ≈ 0.143
 *
 * @param {{ [rarity: string]: number }} baseRates  – e.g. BASE_RATES
 * @param {number}                       gachaRareBonus – e.g. talent.gacha * 0.01
 * @returns {{ [rarity: string]: number }} normalised rates
 */
export function applyGachaRareBonus(baseRates, gachaRareBonus) {
  if (!gachaRareBonus || gachaRareBonus <= 0) return normalizeRates(baseRates)
  const rates = { ...baseRates }
  rates.rare = (rates.rare ?? 0) + gachaRareBonus
  return normalizeRates(rates)
}

/**
 * Returns the effective pity threshold after talent reduction.
 *
 * effectivePity = max(PITY_MIN, PITY_DEFAULT - pityReduction)
 *
 * @param {number} pityReduction – talent bonus (floor(gacha/2))
 * @returns {number}
 */
export function computeEffectivePity(pityReduction) {
  return Math.max(PITY_MIN, PITY_DEFAULT - pityReduction)
}

/**
 * Builds pity-forced rates that guarantee a rare+ result.
 * Redistributes common + uncommon weight proportionally across rare/epic/legendary.
 *
 * @param {{ [rarity: string]: number }} rates – normalised rates
 * @returns {{ [rarity: string]: number }}
 */
function forcePityRates(rates) {
  const rareTotal = (rates.rare ?? 0) + (rates.epic ?? 0) + (rates.legendary ?? 0)
  if (rareTotal === 0) return rates
  const scale = 1 / rareTotal
  return {
    common: 0,
    uncommon: 0,
    rare: (rates.rare ?? 0) * scale,
    epic: (rates.epic ?? 0) * scale,
    legendary: (rates.legendary ?? 0) * scale,
  }
}

/**
 * Resolves a single gacha pull to a rarity string.
 *
 * Iterates rarities from rarest to most common, accumulating probability,
 * and returns the rarity whose cumulative bucket contains `rand`.
 * If `pityReached` is true, uses forced pity rates to guarantee rare or better.
 *
 * @param {{ [rarity: string]: number }} rates – normalised drop rates
 * @param {number}  rand         – random value in [0, 1)
 * @param {boolean} [pityReached=false] – whether the pity threshold has been hit
 * @returns {string} rarity ('common' | 'uncommon' | 'rare' | 'epic' | 'legendary')
 */
export function rollGacha(rates, rand, pityReached = false) {
  const effectiveRates = pityReached ? forcePityRates(rates) : rates
  const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common']
  let cumulative = 0
  for (const rarity of rarities) {
    cumulative += effectiveRates[rarity] ?? 0
    if (rand < cumulative) return rarity
  }
  return 'common'
}

/** Coin cost for a single gacha pull. */
export const GACHA_PULL_COST = 10
