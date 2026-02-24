/**
 * Anti-farming domain rules.
 *
 * PROBLEM
 * -------
 * A player could game XP by creating many tasks with the same title every day
 * and completing them all for repeated XP gains.
 *
 * RULE
 * ----
 * A task is a CLONE if another task with the same normalized title (trimmed,
 * lowercased) already exists for the same dueDate.
 *
 * STRATEGY: Allow but penalise (not hard-block)
 * ---------------------------------------------
 * Clone tasks CAN be created and completed, but they yield 0 XP (isClone=true).
 * Rationale:
 *  - Hard-blocking may frustrate users who legitimately repeat similar tasks.
 *  - Allowing with a penalty is transparent: the UI shows a "clone" badge so
 *    the player knows why they earned no XP.
 *  - Simpler UX than asking "did you mean...?" dialogs.
 *
 * The XP=0 enforcement lives in gamification.taskXpReward, not in the DB layer,
 * so the rule cannot be bypassed by manipulating task order.
 */

/**
 * Returns true if `candidate` is a clone of any task in `existingTasks`.
 *
 * Two tasks are clones when they share the same dueDate and the same title
 * after trimming whitespace and lower-casing.
 *
 * @param {{ title: string, dueDate: string }} candidate
 * @param {Array<{ title: string, dueDate: string }>} existingTasks
 * @returns {boolean}
 */
export function isClone(candidate, existingTasks) {
  const normalized = candidate.title.trim().toLowerCase()
  return existingTasks.some(
    (t) =>
      t.title.trim().toLowerCase() === normalized &&
      t.dueDate === candidate.dueDate
  )
}
