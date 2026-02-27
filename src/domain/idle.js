/**
 * Idle farming domain logic for TaskQuest.
 *
 * All functions are pure (no side effects, no DB access).
 * Designed to be tested in isolation and called from the repository layer.
 */

/** Maximum minutes of idle earnings that can accumulate at once (anti-whale cap). */
export const MAX_IDLE_MINUTES = 180

/**
 * Per-rarity base contribution used in calcTeamMultiplier.
 * Formula: BASE + stage * STEP
 */
const RARITY_BASE = {
  common:    1.00,
  uncommon:  1.05,
  rare:      1.10,
  epic:      1.20,
  legendary: 1.35,
}
const RARITY_STEP = {
  common:    0.05,
  uncommon:  0.06,
  rare:      0.07,
  epic:      0.08,
  legendary: 0.10,
}

/**
 * Calculates the team idle multiplier based on the active team composition.
 *
 * Each character's contribution = BASE[rarity] + stage * STEP[rarity]
 * Total = average of all team members' contributions.
 * Returns 1.0 if the team is empty.
 *
 * @param {string[]} activeTeam         – array of character ids in the active team
 * @param {Object}   characterStages    – map of { characterId: stageNumber } (default 1)
 * @param {Array}    charactersCatalog  – array of { id, rarity, ... } objects
 * @returns {number}
 */
export function calcTeamMultiplier(activeTeam, characterStages, charactersCatalog) {
  if (!activeTeam || activeTeam.length === 0) return 1.0

  const contributions = activeTeam.map((id) => {
    const char = charactersCatalog.find((c) => c.id === id)
    const rarity = char?.rarity ?? 'common'
    const stage = (characterStages && characterStages[id] != null) ? characterStages[id] : 1
    const base = RARITY_BASE[rarity] ?? 1.00
    const step = RARITY_STEP[rarity] ?? 0.05
    return base + stage * step
  })

  const avg = contributions.reduce((sum, v) => sum + v, 0) / contributions.length
  return avg
}

/**
 * Computes idle earnings for a given time window.
 *
 * Rules:
 *  - Elapsed minutes = (now - lastTickAt) / 60_000, clamped to MAX_IDLE_MINUTES.
 *  - Energy is consumed 1 per minute; if energy = 0, no coins are earned.
 *  - minutesUsed = min(elapsedMinutes, energy) — limited by available energy.
 *  - coinsEarned = floor(minutesUsed * baseCpm * multiplier * boostMultiplier).
 *  - boostMultiplier is derived from activeBoosts' coinMultiplier values (highest wins).
 *  - Energy regen (from talent bonus) is applied after spending: min(energyCap, spent + regen).
 *  - newLastTickAt = now (always updated, even if energy = 0).
 *
 * @param {{
 *   now:               number,      – current timestamp (ms)
 *   lastTickAt:        number|null, – previous tick timestamp (ms), null = first tick
 *   energy:            number,      – current energy
 *   energyCap:         number,      – maximum energy (used as regen ceiling)
 *   baseCpm:           number,      – base coins per minute
 *   multiplier:        number,      – team multiplier (from calcTeamMultiplier)
 *   activeBoosts:      Array,       – active boost objects (with coinMultiplier field)
 *   energyRegenPerMin: number,      – energy regenerated per real minute (talent bonus, default 0)
 * }} params
 * @returns {{ coinsEarned: number, minutesUsed: number, newEnergy: number, newLastTickAt: number }}
 */
export function computeIdleEarnings({ now, lastTickAt, energy, energyCap, baseCpm, multiplier, activeBoosts, energyRegenPerMin = 0 }) {
  const newLastTickAt = now

  if (!lastTickAt) {
    // First tick: record timestamp but earn nothing
    return { coinsEarned: 0, minutesUsed: 0, newEnergy: energy, newLastTickAt }
  }

  const elapsedMs = now - lastTickAt
  const elapsedMinutes = Math.min(elapsedMs / 60_000, MAX_IDLE_MINUTES)

  // Energy regeneration applies regardless of whether coins are earned
  const regenGained = energyRegenPerMin > 0 ? elapsedMinutes * energyRegenPerMin : 0

  if (elapsedMinutes < 0) {
    return { coinsEarned: 0, minutesUsed: 0, newEnergy: energy, newLastTickAt }
  }

  if (energy <= 0) {
    // No coins earned, but regen still applies (capped at energyCap)
    const newEnergy = regenGained > 0
      ? Math.min(energyCap, energy + regenGained)
      : energy
    return { coinsEarned: 0, minutesUsed: 0, newEnergy, newLastTickAt }
  }

  // Minutes actually usable is capped by available energy
  const minutesUsed = Math.min(elapsedMinutes, energy)

  // Find the highest coinMultiplier from active boosts (default 1)
  const boostMultiplier = (activeBoosts && activeBoosts.length > 0)
    ? Math.max(...activeBoosts.map((b) => b.coinMultiplier ?? 1))
    : 1

  const coinsEarned = Math.floor(minutesUsed * baseCpm * multiplier * boostMultiplier)
  const energyAfterSpend = Math.max(0, energy - minutesUsed)
  // Regen is applied after spending, capped at energyCap
  const newEnergy = Math.min(energyCap, energyAfterSpend + regenGained)

  return { coinsEarned, minutesUsed, newEnergy, newLastTickAt }
}
