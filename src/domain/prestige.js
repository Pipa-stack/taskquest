/**
 * Prestige/Ascension domain logic for TaskQuest.
 *
 * All functions are pure (no side effects, no DB access).
 * Designed to be tested in isolation and called from the repository layer.
 */

/** Minimum zone id (unlocked) required to perform a prestige. */
export const PRESTIGE_REQUIRED_ZONE = 6

/** Minimum power score required to perform a prestige. */
export const PRESTIGE_REQUIRED_POWER = 250

/**
 * Determines whether the player can perform a prestige (ascension).
 *
 * Requirements:
 *   - currentZone >= 6 (player has reached/unlocked zone 6)
 *   - powerScore >= 250
 *
 * @param {object} player      – player record
 * @param {number} powerScore  – current computed power score
 * @param {number} currentZone – current zone id (passed explicitly for testability)
 * @returns {boolean}
 */
export function canPrestige(player, powerScore, currentZone) {
  if (!player) return false
  const zone = currentZone ?? player.currentZone ?? 1
  return zone >= PRESTIGE_REQUIRED_ZONE && powerScore >= PRESTIGE_REQUIRED_POWER
}

/**
 * Computes the amount of Essence earned from a prestige.
 * Formula: floor(powerScore / 50)
 *
 * @param {number} powerScore – current computed power score
 * @returns {number} essence gained (integer >= 0)
 */
export function computeEssenceGain(powerScore) {
  return Math.floor((powerScore ?? 0) / 50)
}

/**
 * Computes the global multiplier from total accumulated Essence.
 * Formula: 1 + essence × 0.02
 *
 * Examples:
 *   essence=0  → 1.00 (no bonus)
 *   essence=1  → 1.02 (+2%)
 *   essence=10 → 1.20 (+20%)
 *   essence=50 → 2.00 (+100%)
 *
 * @param {number} essence – total accumulated essence
 * @returns {number} multiplier (always >= 1.0)
 */
export function computeGlobalMultiplier(essence) {
  return 1 + (essence ?? 0) * 0.02
}

/**
 * Applies a prestige reset to the player, granting essenceGain Essence
 * and resetting zone/progression fields.
 *
 * Fields RESET:
 *   coins = 0
 *   currentZone = 1
 *   zoneUnlockedMax = 1
 *   zoneProgress = {}
 *   coinsPerMinuteBase = 1
 *   energy = energyCap (refill on prestige)
 *   prestigeCount += 1
 *   essence += essenceGain
 *   globalMultiplierCache = computeGlobalMultiplier(newEssence)
 *
 * Fields PRESERVED (not reset):
 *   xp, streak, level, achievements, unlockedCharacters, activeTeam,
 *   rewardsUnlocked, dailyGoal, energyCap (cap itself is preserved)
 *
 * @param {object} player      – current player record
 * @param {number} essenceGain – essence to add (from computeEssenceGain)
 * @returns {object} new player state (pure — does NOT mutate input)
 */
export function applyPrestige(player, essenceGain) {
  const newEssence = (player.essence ?? 0) + essenceGain
  return {
    ...player,
    coins: 0,
    currentZone: 1,
    zoneUnlockedMax: 1,
    zoneProgress: {},
    coinsPerMinuteBase: 1,
    energy: player.energyCap ?? 100,
    prestigeCount: (player.prestigeCount ?? 0) + 1,
    essence: newEssence,
    globalMultiplierCache: computeGlobalMultiplier(newEssence),
  }
}
