import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { isClone } from '../domain/antifarm.js'
import { taskXpReward, calcUpdatedStreak } from '../domain/gamification.js'
import { calcCombo, applyCombo } from '../domain/combo.js'
import { checkNewAchievements, getAchievement } from '../domain/achievements.js'

/**
 * React hook that exposes tasks for a given date and mutation helpers.
 *
 * @param {string} [selectedDate] - YYYY-MM-DD date to show tasks for.
 *   Defaults to today. Streak / achievement logic always uses the real today.
 *
 * Returns:
 *  - tasks        – live-reactive array of tasks for `selectedDate`
 *  - addTask      – create a new task for `selectedDate`; auto-detects clones
 *  - completeTask – marks a task done, applies combo XP, checks achievements
 *                   Returns Promise<{ xpEarned, newAchievements }>
 */
export function useTasks(selectedDate) {
  const today = todayKey()
  const dateKey = selectedDate || today

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .equals(dateKey)
        .sortBy('createdAt'),
    [dateKey]
  )

  /**
   * Creates a new task for `dateKey`. Detects clones (same normalised title)
   * and marks them with isClone=true so they earn 0 XP on completion.
   */
  const addTask = useCallback(
    async (title) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const existing = await db.tasks.where('dueDate').equals(dateKey).toArray()
      const clone = isClone({ title: trimmed, dueDate: dateKey }, existing)

      await db.tasks.add({
        title: trimmed,
        dueDate: dateKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
        isClone: clone,
      })
    },
    [dateKey]
  )

  /**
   * Marks a task as done, awards XP with combo multiplier, updates streak,
   * and checks for newly unlocked achievements.
   *
   * Idempotent: silently no-ops if the task is already done.
   * @returns {Promise<{ xpEarned: number, newAchievements: string[] }>}
   */
  const completeTask = useCallback(async (taskId) => {
    const task = await db.tasks.get(taskId)
    if (!task || task.status === 'done') return { xpEarned: 0, newAchievements: [] }

    const baseXp = taskXpReward(task)
    const now = new Date()
    let xpEarned = 0
    let newAchievements = []

    await db.transaction('rw', [db.tasks, db.players], async () => {
      await db.tasks.update(taskId, {
        status: 'done',
        completedAt: now.toISOString(),
      })

      const player = (await db.players.get(1)) ?? {
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

      // Combo calculation (not for clones)
      const newCombo = task.isClone
        ? (player.combo ?? 1.0)
        : calcCombo(player.combo ?? 1.0, player.lastCompleteAt, now)

      xpEarned = applyCombo(baseXp, newCombo, task.isClone)

      const streakUpdate = calcUpdatedStreak(player, now)

      // Count today's completed tasks (after this one)
      const todayDone = await db.tasks
        .where('[dueDate+status]')
        .equals([today, 'done'])
        .count()
      const todayTasksCount = todayDone + 1  // +1 for the task we just completed

      // Count all-time completed tasks
      const totalTasks = await db.tasks
        .where('status')
        .equals('done')
        .count()
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
  }, [today])

  return { tasks: tasks ?? [], addTask, completeTask, dateKey }
}
