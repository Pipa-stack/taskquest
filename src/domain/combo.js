/**
 * Combo (Momentum) system.
 *
 * If a player completes tasks within COMBO_WINDOW_MS of each other, the combo
 * multiplier rises: 1.0 → 1.1 → 1.2 → 1.3 → 1.4 (capped at MAX_COMBO).
 * If more than COMBO_WINDOW_MS passes without a completion the combo resets to 1.0.
 *
 * The combo is NOT applied to clone tasks (they always yield 0 XP anyway).
 */

export const COMBO_WINDOW_MS = 90_000   // 90 seconds
export const COMBO_STEP = 0.1
export const MIN_COMBO = 1.0
export const MAX_COMBO = 1.4

/**
 * Returns the updated combo multiplier after a task completion.
 *
 * @param {number} currentCombo  – current combo (e.g. 1.2)
 * @param {string|null} lastCompleteAt – ISO timestamp of previous completion
 * @param {Date} [now=new Date()]       – injectable for deterministic tests
 * @returns {number} new combo multiplier (1.0 – 1.4, one decimal place)
 */
export function calcCombo(currentCombo, lastCompleteAt, now = new Date()) {
  if (!lastCompleteAt) {
    // First completion ever – start at base
    return MIN_COMBO
  }

  const elapsed = now.getTime() - new Date(lastCompleteAt).getTime()

  if (elapsed > COMBO_WINDOW_MS) {
    // Window expired – reset
    return MIN_COMBO
  }

  // Still within window – step up, capped at MAX_COMBO
  const next = Math.round((currentCombo + COMBO_STEP) * 10) / 10
  return Math.min(next, MAX_COMBO)
}

/**
 * Returns the XP after applying the combo multiplier (rounded to integer).
 * Combo is never applied to clone tasks.
 *
 * @param {number} baseXp
 * @param {number} combo
 * @param {boolean} isClone
 * @returns {number}
 */
export function applyCombo(baseXp, combo, isClone) {
  if (isClone || baseXp === 0) return baseXp
  return Math.round(baseXp * combo)
}
