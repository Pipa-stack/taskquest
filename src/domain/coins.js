/**
 * Coins economy for TaskQuest.
 *
 * Completing tasks earns coins that can be spent in the character shop.
 * Clone tasks (anti-farming) always yield 0 coins.
 * Coins are based on task difficulty with safe defaults.
 */

const COINS_BY_DIFFICULTY = {
  easy: 5,
  medium: 8,
  hard: 12,
}

const COINS_DEFAULT = 5

/**
 * Returns the number of coins earned for completing a task.
 *
 * Rules:
 * - Clone tasks (isClone === true) → 0 coins (anti-farming)
 * - Otherwise: base coins by difficulty (easy=5, medium=8, hard=12)
 * - If no difficulty field, defaults to 5 (same as easy)
 *
 * @param {object} task - The task being completed
 * @param {boolean} [task.isClone] - Whether the task is a clone (anti-farming)
 * @param {string} [task.difficulty] - 'easy' | 'medium' | 'hard'
 * @returns {number} coins earned (always >= 0)
 */
export function coinsForTask(task) {
  if (task.isClone) return 0
  return COINS_BY_DIFFICULTY[task.difficulty] ?? COINS_DEFAULT
}
