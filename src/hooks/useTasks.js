import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { isClone } from '../domain/antifarm.js'
import { taskXpReward, calcUpdatedStreak } from '../domain/gamification.js'
import { calcCombo, applyCombo } from '../domain/combo.js'
import { checkNewAchievements, getAchievement } from '../domain/achievements.js'

/**
 * React hook that exposes tasks for a given day and mutation helpers.
 *
 * @param {string} [dateKey]  YYYY-MM-DD key for the day to show.
 *                            Defaults to todayKey() when omitted.
 *
 * Returns:
 *  - tasks        – live-reactive array of tasks for dateKey (pending first, then done)
 *  - addTask      – create a new task for dateKey; auto-detects clones
 *  - completeTask – marks a task done, applies combo XP, checks achievements
 *                   Returns Promise<{ xpEarned, newAchievements }>
 */
export function useTasks(dateKey) {
  const resolvedDateKey = dateKey ?? todayKey()

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .equals(resolvedDateKey)
        .sortBy('createdAt'),
    [resolvedDateKey]
  )

  /**
   * Creates a new task for resolvedDateKey. Detects clones (same normalised title)
   * and marks them with isClone=true so they earn 0 XP on completion.
   */
  const addTask = useCallback(
    async (title) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const existing = await db.tasks.where('dueDate').equals(resolvedDateKey).toArray()
      const clone = isClone({ title: trimmed, dueDate: resolvedDateKey }, existing)

      await db.tasks.add({
        title: trimmed,
        dueDate: resolvedDateKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
        isClone: clone,
      })
    },
    [resolvedDateKey]
  )

  /**
   * Marks a task as done, awards XP with combo multiplier, updates streak,
   * and checks for newly unlocked achievements.
   *
   * Daily-goal / mission counting always uses the real today, not the
   * selected day, so navigating to another day never breaks missions.
   *
   * Idempotent: silently no-ops if the task is already done.
   * @returns {Promise<{ xpEarned: number, newAchievements: string[] }>}
   */
  const completeTask = useCallback(async (taskId) => {
    const task = await db.tasks.get(taskId)
    if (!task || task.status === 'done') return { xpEarned: 0, newAchievements: [] }

    const baseXp = taskXpReward(task)
    const now = new Date()
    // Achievements / daily-goal always track the real today, regardless of which
    // day the user is currently viewing.
    const realToday = todayKey()
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

      // Count today's completed tasks (after this one) — always uses real today
      const todayDone = await db.tasks
        .where('[dueDate+status]')
        .equals([realToday, 'done'])
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
  }, [])  // completeTask has no dependency on dateKey; it always uses real today internally

  return { tasks: tasks ?? [], addTask, completeTask }
}
