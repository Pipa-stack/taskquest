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
 * Internal helper: picks a rarity from a rates table via cumulative probability.
 *
 * @param {object}   rates – normalised rate table
 * @param {function} rng   – random number generator (returns [0, 1))
 * @returns {string} rarity key
 */
function rollFromRates(rates, rng) {
  const r = rng()
  let cumulative = 0
  for (const [rarity, prob] of Object.entries(rates)) {
    cumulative += prob
    if (r < cumulative) return rarity
  }
  // Fallback for floating-point rounding edge case
  return Object.keys(rates)[Object.keys(rates).length - 1]
}

/**
 * Rolls a gacha pull and returns the resulting rarity.
 *
 * Rules:
 *   - If pityCount + 1 >= pityThreshold → guaranteed 'rare' or better.
 *     (Picks from rare/epic/legendary with proportional re-normalisation.)
 *   - Otherwise, sample from the provided rates table using cumulative probability.
 *
 * @param {object}   rates         – normalised drop rates (e.g. from applyGachaRareBonus)
 * @param {number}   pityCount     – non-rare pulls since last rare+ (0-indexed)
 * @param {number}   pityThreshold – effective pity threshold from computeEffectivePity
 * @param {function} [rng]         – RNG function returning [0, 1) (default: Math.random)
 * @returns {'common'|'uncommon'|'rare'|'epic'|'legendary'}
 */
export function rollGacha(rates, pityCount, pityThreshold, rng = Math.random) {
  // Pity trigger: guarantee rare or better
  if (pityCount + 1 >= pityThreshold) {
    const pityRates = normalizeRates({
      rare:      rates.rare      ?? 0.10,
      epic:      rates.epic      ?? 0.04,
      legendary: rates.legendary ?? 0.01,
    })
    return rollFromRates(pityRates, rng)
  }
  return rollFromRates(rates, rng)
}
