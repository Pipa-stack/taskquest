/**
 * playerRepository.js
 *
 * Single source of truth for all player DB operations.
 * Only this module may import `db` directly for player-related queries.
 *
 * Reactivity strategy (Option B):
 *   - All functions are pure async (no React hooks here).
 *   - usePlayer hook wraps getLive() with useLiveQuery.
 */
import db from '../db/db.js'

export const PLAYER_DEFAULTS = {
  id: 1,
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  combo: 1.0,
  lastCompleteAt: null,
  dailyGoal: 3,
  achievementsUnlocked: [],
  rewardsUnlocked: [],
}

/**
 * Get the player record (id=1).
 * Returns undefined if the player has never been written.
 * Intended for use inside useLiveQuery (Dexie tracks the read).
 *
 * @returns {Promise<object|undefined>}
 */
export function getLive() {
  return db.players.get(1)
}

/**
 * Get the player record, initialising with defaults if none exists.
 *
 * @returns {Promise<object>}
 */
export async function getOrCreate() {
  return (await db.players.get(1)) ?? { ...PLAYER_DEFAULTS }
}

/**
 * Merge partial fields into the player record.
 *
 * @param {Partial<object>} partial
 * @returns {Promise<void>}
 */
export async function update(partial) {
  const player = await getOrCreate()
  await db.players.put({ ...player, ...partial, id: 1 })
}

/**
 * Set the daily goal target tasks count.
 *
 * @param {number} value
 * @returns {Promise<void>}
 */
export function setDailyGoal(value) {
  return update({ dailyGoal: value })
}

/**
 * Purchase a reward by spending XP.
 * Silently no-ops if the reward is already unlocked or XP is insufficient,
 * ensuring XP can never go negative.
 *
 * @param {number} cost      XP cost of the reward
 * @param {string} rewardId  Reward identifier
 * @returns {Promise<void>}
 */
export async function spendXp(cost, rewardId) {
  await db.transaction('rw', [db.players], async () => {
    const player = (await db.players.get(1)) ?? { ...PLAYER_DEFAULTS }
    const alreadyUnlocked = (player.rewardsUnlocked ?? []).includes(rewardId)
    if (alreadyUnlocked || player.xp < cost) return

    await db.players.put({
      ...player,
      id: 1,
      xp: player.xp - cost,
      rewardsUnlocked: [...(player.rewardsUnlocked ?? []), rewardId],
    })
  })
}
