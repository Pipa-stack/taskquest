/**
 * Daily loop reward domain logic for TaskQuest.
 *
 * The daily loop is completed once per day when the player:
 *   1. Completes >= dailyGoal tasks today
 *   2. Manually claims idle earnings at least once today
 *   3. Does at least 1 gacha pull today
 *
 * Reward: +50 coins, +10 essence (granted once per day).
 *
 * All functions are pure (no side effects, no DB access).
 */

/** Fixed daily loop reward. */
export const DAILY_LOOP_REWARD = { coins: 50, essence: 10 }

/**
 * Returns true if all daily loop conditions are satisfied.
 *
 * @param {object} params
 * @param {number} params.todayDone         – tasks completed today
 * @param {number} params.dailyGoal         – daily task target
 * @param {string|null} params.lastIdleClaimDate  – YYYY-MM-DD of last manual idle claim
 * @param {string|null} params.lastGachaPullDate  – YYYY-MM-DD of last gacha pull
 * @param {string} params.today             – today's YYYY-MM-DD key
 * @returns {boolean}
 */
export function isDailyLoopComplete({ todayDone, dailyGoal, lastIdleClaimDate, lastGachaPullDate, today }) {
  const goalMet = (todayDone ?? 0) >= (dailyGoal ?? 3)
  const idleMet = lastIdleClaimDate === today
  const gachaMet = lastGachaPullDate === today
  return goalMet && idleMet && gachaMet
}

/**
 * Returns true if the daily loop reward was already claimed today.
 *
 * @param {object} player – player record (dailyLoopClaimedDate field)
 * @param {string} today  – today's YYYY-MM-DD key
 * @returns {boolean}
 */
export function hasDailyLoopClaimed(player, today) {
  return (player.dailyLoopClaimedDate ?? null) === today
}

/**
 * Applies the daily loop reward to a player snapshot (pure mutation).
 * Increments coins and essence, and marks the date as claimed.
 *
 * Does NOT validate conditions — callers must check isDailyLoopComplete first.
 *
 * @param {object} player – player record
 * @param {string} today  – today's YYYY-MM-DD key
 * @returns {object} updated player snapshot
 */
export function applyDailyLoopReward(player, today) {
  return {
    ...player,
    coins: (player.coins ?? 0) + DAILY_LOOP_REWARD.coins,
    essence: (player.essence ?? 0) + DAILY_LOOP_REWARD.essence,
    dailyLoopClaimedDate: today,
  }
}

/**
 * Returns a summary of daily loop progress: which conditions are met.
 *
 * @param {object} params – same params as isDailyLoopComplete
 * @returns {{ goalMet: boolean, idleMet: boolean, gachaMet: boolean, allDone: boolean }}
 */
export function getDailyLoopStatus({ todayDone, dailyGoal, lastIdleClaimDate, lastGachaPullDate, today }) {
  const goalMet = (todayDone ?? 0) >= (dailyGoal ?? 3)
  const idleMet = lastIdleClaimDate === today
  const gachaMet = lastGachaPullDate === today
  return {
    goalMet,
    idleMet,
    gachaMet,
    allDone: goalMet && idleMet && gachaMet,
  }
}
