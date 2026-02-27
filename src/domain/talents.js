/**
 * Talent tree domain logic for TaskQuest.
 *
 * Players spend Essence to buy talent points across 3 branches:
 *   idle  – boosts passive coin generation and energy cap
 *   gacha – improves rare drop rates and reduces pity threshold
 *   power – amplifies combat power and reduces evolution costs
 *
 * All functions are pure (no side effects, no DB access).
 */

/** Maximum points per talent branch. */
export const TALENT_MAX = 10

/**
 * Returns the essence cost for purchasing the next point in a branch.
 * Cost is 1-indexed: buying point #1 costs 1, point #2 costs 2, …, point #10 costs 10.
 *
 * @param {number} currentPoints – current level (0–9)
 * @returns {number}
 */
export function costForNextPoint(currentPoints) {
  return currentPoints + 1
}

/**
 * Returns the total essence required to reach a given number of points from 0.
 * Sum of 1..points = points*(points+1)/2.
 *
 * @param {number} points – target level (0–10)
 * @returns {number}
 */
export function totalCost(points) {
  if (points <= 0) return 0
  return (points * (points + 1)) / 2
}

/**
 * Computes all talent bonuses from current talent levels.
 *
 * Idle branch:
 *   idleCoinMult     = 1 + idle * 0.03     (e.g. idle=3 → 1.09)
 *   energyCapBonus   = floor(idle/3) * 5   (every 3 points: +5 cap)
 *
 * Gacha branch:
 *   gachaRareBonus   = gacha * 0.01        (added to rare+ drop rates)
 *   pityReduction    = floor(gacha/2)      (subtracted from pity max, min 20)
 *
 * Power branch:
 *   powerMult        = 1 + power * 0.04   (e.g. power=5 → 1.20)
 *   evolveDiscount   = min(0.4, floor(power/3)*0.05) (up to 40% off evolution costs)
 *
 * @param {{ idle?: number, gacha?: number, power?: number }} talents
 * @returns {{
 *   idleCoinMult: number,
 *   energyCapBonus: number,
 *   gachaRareBonus: number,
 *   pityReduction: number,
 *   powerMult: number,
 *   evolveDiscount: number,
 * }}
 */
export function computeTalentBonuses(talents) {
  const idle  = Math.max(0, Math.floor(talents?.idle  ?? 0))
  const gacha = Math.max(0, Math.floor(talents?.gacha ?? 0))
  const power = Math.max(0, Math.floor(talents?.power ?? 0))

  return {
    idleCoinMult:   1 + idle * 0.03,
    energyCapBonus: Math.floor(idle / 3) * 5,
    gachaRareBonus: gacha * 0.01,
    pityReduction:  Math.floor(gacha / 2),
    powerMult:      1 + power * 0.04,
    evolveDiscount: Math.min(0.4, Math.floor(power / 3) * 0.05),
  }
}

/**
 * Returns true if the player has enough essence to buy a talent point
 * in the given branch and the branch hasn't reached TALENT_MAX.
 *
 * @param {object} player  – player record (needs .essence and .talents)
 * @param {string} branch  – 'idle' | 'gacha' | 'power'
 * @returns {boolean}
 */
export function canSpendEssence(player, branch) {
  const talents = player.talents ?? { idle: 0, gacha: 0, power: 0 }
  const currentPoints = talents[branch] ?? 0
  if (currentPoints >= TALENT_MAX) return false
  const cost = costForNextPoint(currentPoints)
  return (player.essence ?? 0) >= cost
}

/**
 * Returns an updated player snapshot after spending essence on a talent point.
 * Returns the original player unchanged if the spend is not allowed.
 *
 * Changes:
 *   - essence       -= cost
 *   - talents[branch] += 1
 *   - essenceSpent  += cost
 *
 * @param {object} player  – player record
 * @param {string} branch  – 'idle' | 'gacha' | 'power'
 * @returns {object} updated player (shallow copy)
 */
export function applySpendEssence(player, branch) {
  if (!canSpendEssence(player, branch)) return player

  const talents = { ...(player.talents ?? { idle: 0, gacha: 0, power: 0 }) }
  const currentPoints = talents[branch] ?? 0
  const cost = costForNextPoint(currentPoints)

  talents[branch] = currentPoints + 1

  return {
    ...player,
    essence:      (player.essence      ?? 0) - cost,
    talents,
    essenceSpent: (player.essenceSpent ?? 0) + cost,
  }
}
