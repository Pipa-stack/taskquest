/**
 * Gamification domain: XP, levels, and streak calculation.
 */
import { localDateKey } from './dateKey.js'

export const XP_PER_TASK = 100
export const XP_PER_LEVEL = 500

/** Coin rewards by task difficulty for non-clone tasks. */
export const COIN_REWARDS = { easy: 5, medium: 8, hard: 12 }

/**
 * Returns the XP reward for completing a task.
 * Clone tasks (anti-farming duplicates) always give 0 XP.
 * @param {{ isClone?: boolean }} task
 * @returns {number}
 */
export function taskXpReward(task) {
  return task.isClone ? 0 : XP_PER_TASK
}

/**
 * Returns the coin reward for completing a task.
 * Clone tasks always give 0 coins.
 * Difficulty-based: hard=12, medium=8, default/easy=5.
 * @param {{ isClone?: boolean, difficulty?: 'easy'|'medium'|'hard' }} task
 * @returns {number}
 */
export function taskCoinReward(task) {
  if (task.isClone) return 0
  return COIN_REWARDS[task.difficulty] ?? COIN_REWARDS.easy
}

/**
 * Returns the 1-based player level for the given total XP.
 * Level 1 starts at 0 XP; each level requires XP_PER_LEVEL more XP.
 * @param {number} xp
 * @returns {number}
 */
export function xpToLevel(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

/**
 * Returns XP remaining until the next level.
 * @param {number} xp
 * @returns {number}
 */
export function xpToNextLevel(xp) {
  return XP_PER_LEVEL - (xp % XP_PER_LEVEL)
}

/**
 * Calculates the updated streak for a player who just completed a task.
 *
 * Rules (all dates are LOCAL timezone YYYY-MM-DD, never UTC):
 *  - No previous activity  → streak = 1
 *  - Already active today  → streak unchanged
 *  - Active yesterday      → streak + 1
 *  - Missed ≥ 1 day        → streak resets to 1
 *
 * @param {{ streak: number, lastActiveDate: string|null }} player
 * @param {Date} [now=new Date()] - Injectable for deterministic tests
 * @returns {{ streak: number, lastActiveDate: string }}
 */
export function calcUpdatedStreak(player, now = new Date()) {
  const today = localDateKey(now)

  if (!player.lastActiveDate) {
    return { streak: 1, lastActiveDate: today }
  }

  if (player.lastActiveDate === today) {
    // Already logged today – don't double-count
    return { streak: player.streak, lastActiveDate: today }
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = localDateKey(yesterday)

  if (player.lastActiveDate === yesterdayKey) {
    return { streak: (player.streak || 0) + 1, lastActiveDate: today }
  }

  // Gap in activity – reset streak
  return { streak: 1, lastActiveDate: today }
}
