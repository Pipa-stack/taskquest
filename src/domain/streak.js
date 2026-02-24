const toDateStr = (date) => {
  if (!date) return null
  return new Date(date).toISOString().split('T')[0]
}

const today     = () => new Date().toISOString().split('T')[0]
const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

/**
 * Pure function. Given the current streak count and the last date the user
 * completed a task, returns the new streak value after a task completion.
 *
 * Rules:
 *  - Completed today already  → no change (streak already counted)
 *  - Completed yesterday      → streak + 1
 *  - Anything older / null    → reset to 1
 */
export const computeNewStreak = (currentStreak, lastActiveDate) => {
  const last = toDateStr(lastActiveDate)
  if (last === today())     return currentStreak      // already counted today
  if (last === yesterday()) return currentStreak + 1  // consecutive day
  return 1                                            // first ever or broken
}

/**
 * Returns true when the player was active yesterday but hasn't completed
 * anything yet today — the streak is at risk of breaking.
 */
export const isStreakAtRisk = (lastActiveDate) => {
  if (!lastActiveDate) return false
  return toDateStr(lastActiveDate) === yesterday()
}
