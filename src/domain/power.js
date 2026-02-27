/**
 * Power score computation for TaskQuest.
 *
 * Power score represents the combat strength of the active team.
 * It is used to gate zone unlocks — higher zones require more power.
 *
 * Base power by rarity:
 *   common 10 | uncommon 18 | rare 30 | epic 55 | legendary 90
 *
 * Stage multipliers (evolution):
 *   stage 1 ×1.0 | stage 2 ×1.35 | stage 3 ×1.8
 *
 * Final score = sum of top-3 character scores (team has at most 3 slots).
 */

const RARITY_BASE = {
  common: 10,
  uncommon: 18,
  rare: 30,
  epic: 55,
  legendary: 90,
}

const STAGE_MULT = {
  1: 1,
  2: 1.35,
  3: 1.8,
}

/**
 * Computes the power score for the active team.
 *
 * @param {string[]} activeTeam        – array of character ids (max 3)
 * @param {object}  characterStages    – { [characterId]: 1 | 2 | 3 }; defaults stage 1 for missing
 * @param {object[]} catalog           – character catalog (array of { id, rarity })
 * @param {number}  globalMultiplier   – prestige global multiplier (default 1)
 * @returns {number} integer power score (sum of top-3 individual scores × globalMultiplier)
 */
export function computePowerScore(activeTeam, characterStages, catalog, globalMultiplier = 1) {
  if (!Array.isArray(activeTeam) || activeTeam.length === 0) return 0

  const scores = activeTeam.map((id) => {
    const char = catalog.find((c) => c.id === id)
    if (!char) return 0
    const base = RARITY_BASE[char.rarity] ?? 10
    const stage = (characterStages ?? {})[id] ?? 1
    const mult = STAGE_MULT[stage] ?? 1
    return Math.round(base * mult)
  })

  // Take top 3 (team already capped at 3 but sort defensively)
  const top3 = [...scores].sort((a, b) => b - a).slice(0, 3)
  return Math.round(top3.reduce((sum, v) => sum + v, 0) * globalMultiplier)
}
