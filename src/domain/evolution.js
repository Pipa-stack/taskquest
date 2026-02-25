/**
 * Evolution domain logic for TaskQuest.
 *
 * Each unlocked character starts at Stage 1 and can evolve to Stage 2 and Stage 3.
 * Evolution costs coins and has no gameplay bonuses — purely cosmetic progression.
 *
 * Cost table (stage 1→2 / stage 2→3):
 *   common    120 / 300
 *   rare      180 / 450
 *   epic      260 / 650
 *   legendary 400 / 1000
 */

const EVO_COSTS = {
  common:    [120, 300],
  rare:      [180, 450],
  epic:      [260, 650],
  legendary: [400, 1000],
}

/**
 * Returns the current evolution stage (1, 2, or 3) for a character.
 * Defaults to 1 if the character has never been evolved.
 *
 * @param {string} characterId
 * @param {object} player - Player record (may have characterStages field)
 * @returns {1|2|3}
 */
export function getStage(characterId, player) {
  return (player.characterStages ?? {})[characterId] ?? 1
}

/**
 * Returns true if the character can still evolve (stage < 3).
 *
 * @param {string} characterId
 * @param {object} player
 * @returns {boolean}
 */
export function canEvolve(characterId, player) {
  return getStage(characterId, player) < 3
}

/**
 * Returns the coin cost to evolve the character to its next stage.
 * Returns null if the character is already at Stage 3 (cannot evolve).
 *
 * @param {string} characterId
 * @param {'common'|'rare'|'epic'|'legendary'} rarity
 * @param {object} player
 * @returns {number|null}
 */
export function evolveCost(characterId, rarity, player) {
  const stage = getStage(characterId, player)
  if (stage >= 3) return null
  const costs = EVO_COSTS[rarity]
  if (!costs) return null
  // stage 1→2 uses index 0, stage 2→3 uses index 1
  return costs[stage - 1]
}

/**
 * Returns a new player object with the character advanced one stage.
 * Does NOT spend coins — the repository layer handles the transaction.
 * Returns the original player unchanged if already at Stage 3.
 *
 * @param {string} characterId
 * @param {object} player
 * @returns {object} updated player
 */
export function evolve(characterId, player) {
  const stage = getStage(characterId, player)
  if (stage >= 3) return player
  return {
    ...player,
    characterStages: {
      ...(player.characterStages ?? {}),
      [characterId]: stage + 1,
    },
  }
}
