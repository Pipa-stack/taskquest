/**
 * Achievements system.
 *
 * Each achievement has:
 *  - id          unique string key
 *  - title       display name
 *  - description short explanation
 *  - check(ctx)  pure function → boolean (is this achievement now unlocked?)
 *
 * check() receives a context object:
 *  {
 *    totalTasks,      // number – all-time completed tasks count
 *    todayTasks,      // number – tasks completed today
 *    streak,          // number
 *    dailyGoalMet,    // boolean – todayTasks >= dailyGoal
 *    combo,           // number – current combo multiplier
 *  }
 */

export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Completa tu primera tarea',
    check: ({ totalTasks }) => totalTasks >= 1,
  },
  {
    id: 'getting_started',
    title: 'Getting Started',
    description: 'Completa 5 tareas en total',
    check: ({ totalTasks }) => totalTasks >= 5,
  },
  {
    id: 'grinder',
    title: 'Grinder',
    description: 'Completa 25 tareas en total',
    check: ({ totalTasks }) => totalTasks >= 25,
  },
  {
    id: 'daily_hero',
    title: 'Daily Hero',
    description: 'Cumple tu objetivo diario',
    check: ({ dailyGoalMet }) => dailyGoalMet,
  },
  {
    id: 'streak_3',
    title: 'Streak 3',
    description: 'Mantén una racha de 3 días',
    check: ({ streak }) => streak >= 3,
  },
  {
    id: 'streak_7',
    title: 'Streak 7',
    description: 'Mantén una racha de 7 días',
    check: ({ streak }) => streak >= 7,
  },
  {
    id: 'combo_1_3',
    title: 'On Fire',
    description: 'Alcanza un combo x1.3',
    check: ({ combo }) => combo >= 1.3,
  },
  {
    id: 'ten_today',
    title: 'Centurión del Día',
    description: 'Completa 10 tareas en un día',
    check: ({ todayTasks }) => todayTasks >= 10,
  },
]

/**
 * Returns ids of achievements that are newly unlocked (not yet in unlockedIds).
 *
 * @param {string[]} unlockedIds  – already-unlocked achievement ids
 * @param {object}   ctx          – check context (see above)
 * @returns {string[]}            – ids to unlock now
 */
export function checkNewAchievements(unlockedIds, ctx) {
  const unlockedSet = new Set(unlockedIds)
  return ACHIEVEMENTS
    .filter((a) => !unlockedSet.has(a.id) && a.check(ctx))
    .map((a) => a.id)
}

/**
 * Looks up an achievement by id.
 * @param {string} id
 * @returns {{ id, title, description, check } | undefined}
 */
export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
