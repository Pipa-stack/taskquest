/**
 * taskRepository.js
 *
 * Single source of truth for all task DB operations.
 * Only this module may import `db` directly for task-related queries.
 *
 * Reactivity strategy (Option B):
 *   - All functions are pure async (no React hooks here).
 *   - Hooks/components wrap calls with useLiveQuery so Dexie tracks reads.
 */
import db from '../db/db.js'
import { isClone } from '../domain/antifarm.js'
import { taskXpReward, calcUpdatedStreak } from '../domain/gamification.js'
import { calcCombo, applyCombo } from '../domain/combo.js'
import { checkNewAchievements } from '../domain/achievements.js'
import { todayKey } from '../domain/dateKey.js'

const PLAYER_DEFAULTS = {
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
 * Get tasks for a specific date, sorted by createdAt.
 * Suitable for use inside useLiveQuery (Dexie tracks the read).
 *
 * @param {string} dateKey  YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export function getByDate(dateKey) {
  return db.tasks.where('dueDate').equals(dateKey).sortBy('createdAt')
}

/**
 * Get tasks within a date range (both ends inclusive).
 * Used by MiniCalendar and StatsTab for range aggregations.
 *
 * @param {string} startKey  YYYY-MM-DD
 * @param {string} endKey    YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export function getRange(startKey, endKey) {
  return db.tasks.where('dueDate').between(startKey, endKey, true, true).toArray()
}

/**
 * Get all tasks in the database.
 * Used by StatsTab for 7-day aggregation.
 *
 * @returns {Promise<object[]>}
 */
export function getAll() {
  return db.tasks.toArray()
}

/**
 * Create a task for a date with automatic clone detection.
 * Silently no-ops if title is blank.
 *
 * @param {{ title: string, dueDate: string }} params
 * @returns {Promise<void>}
 */
export async function create({ title, dueDate }) {
  const trimmed = title.trim()
  if (!trimmed) return

  const existing = await db.tasks.where('dueDate').equals(dueDate).toArray()
  const clone = isClone({ title: trimmed, dueDate }, existing)

  await db.tasks.add({
    title: trimmed,
    dueDate,
    status: 'pending',
    createdAt: new Date().toISOString(),
    isClone: clone,
  })
}

/**
 * Mark a task as done, award XP with combo multiplier, update streak,
 * and check for newly unlocked achievements.
 *
 * Idempotent: silently no-ops if the task is already done.
 * Clone tasks always earn 0 XP and do not advance the combo.
 *
 * @param {number} taskId
 * @returns {Promise<{ xpEarned: number, newAchievements: string[] }>}
 */
export async function complete(taskId) {
  const task = await db.tasks.get(taskId)
  if (!task || task.status === 'done') return { xpEarned: 0, newAchievements: [] }

  const baseXp = taskXpReward(task)
  const now = new Date()
  const today = todayKey()
  let xpEarned = 0
  let newAchievements = []

  await db.transaction('rw', [db.tasks, db.players], async () => {
    await db.tasks.update(taskId, {
      status: 'done',
      completedAt: now.toISOString(),
    })

    const player = (await db.players.get(1)) ?? { ...PLAYER_DEFAULTS }

    // Combo: clones don't advance or benefit from the combo multiplier
    const newCombo = task.isClone
      ? (player.combo ?? 1.0)
      : calcCombo(player.combo ?? 1.0, player.lastCompleteAt, now)

    xpEarned = applyCombo(baseXp, newCombo, task.isClone)

    const streakUpdate = calcUpdatedStreak(player, now)

    // Counts for achievement checks (always use real today for streak/daily logic)
    const todayDone = await db.tasks
      .where('[dueDate+status]')
      .equals([today, 'done'])
      .count()
    const todayTasksCount = todayDone + 1 // +1 for the task we just completed

    const totalTasks = await db.tasks.where('status').equals('done').count()
    const totalTasksCount = totalTasks + 1

    const dailyGoal = player.dailyGoal ?? 3
    const dailyGoalMet = todayTasksCount >= dailyGoal

    const achievementCtx = {
      totalTasks: totalTasksCount,
      todayTasks: todayTasksCount,
      streak: streakUpdate.streak,
      dailyGoalMet,
      combo: newCombo,
    }

    const currentUnlocked = player.achievementsUnlocked ?? []
    newAchievements = checkNewAchievements(currentUnlocked, achievementCtx)

    await db.players.put({
      ...player,
      id: 1,
      xp: player.xp + xpEarned,
      combo: newCombo,
      lastCompleteAt: now.toISOString(),
      achievementsUnlocked: [...currentUnlocked, ...newAchievements],
      ...streakUpdate,
    })
  })

  return { xpEarned, newAchievements }
}

/**
 * Count tasks matching a specific date and status.
 * Used by PlayerStats for daily goal progress.
 *
 * @param {string} dateKey   YYYY-MM-DD
 * @param {'pending'|'done'} status
 * @returns {Promise<number>}
 */
export function countByDateAndStatus(dateKey, status) {
  return db.tasks.where('[dueDate+status]').equals([dateKey, status]).count()
}
