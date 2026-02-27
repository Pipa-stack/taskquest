/**
 * Daily loop domain logic for TaskQuest.
 *
 * The daily loop rewards players for completing 3 conditions each day:
 *  1. goalMet     – player completed their daily task goal
 *  2. idleClaimed – player manually claimed idle coins today
 *  3. gachaPulled – player did at least one gacha pull today
 *
 * Reward: +50 coins, +10 essence (DAILY_LOOP_REWARD)
 * Can only be claimed once per day (tracked by dailyLoopClaimedDate).
 *
 * All functions are pure (no side effects, no DB access).
 */

export const DAILY_LOOP_REWARD = { coins: 50, essence: 10 }

/**
 * Evaluates whether each daily loop condition has been met.
 *
 * @param {object} player     – player state snapshot
 * @param {number} todayDone  – number of tasks completed today
 * @param {string} today      – today's date key (YYYY-MM-DD)
 * @returns {{ goalMet: boolean, idleClaimed: boolean, gachaPulled: boolean, allDone: boolean }}
 */
export function getDailyLoopStatus(player, todayDone, today) {
  const dailyGoal = player.dailyGoal ?? 3
  const goalMet = todayDone >= dailyGoal
  const idleClaimed = (player.lastIdleClaimDate ?? null) === today
  const gachaPulled = (player.lastGachaPullDate ?? null) === today
  const allDone = goalMet && idleClaimed && gachaPulled
  return { goalMet, idleClaimed, gachaPulled, allDone }
}

/**
 * Returns true if the daily loop reward has already been claimed today.
 *
 * @param {object} player
 * @param {string} today – today's date key (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isDailyLoopClaimed(player, today) {
  return (player.dailyLoopClaimedDate ?? null) === today
}

/**
 * Applies the daily loop reward to a player snapshot.
 * Does NOT persist — call from the repository layer.
 *
 * @param {object} player
 * @param {string} today – today's date key (YYYY-MM-DD)
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
