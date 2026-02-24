import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { isClone } from '../domain/antifarm.js'
import { taskXpReward, calcUpdatedStreak } from '../domain/gamification.js'

/**
 * React hook that exposes today's tasks and mutation helpers.
 *
 * Returns:
 *  - tasks      – live-reactive array of today's tasks (pending first, then done)
 *  - addTask    – create a new task for today; auto-detects clones
 *  - completeTask – marks a task done and awards XP; returns XP earned (0 for clones)
 */
export function useTasks() {
  const today = todayKey()

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .equals(today)
        .sortBy('createdAt'),
    [today]
  )

  /**
   * Creates a new task for today. Detects clones (same normalised title)
   * and marks them with isClone=true so they earn 0 XP on completion.
   */
  const addTask = useCallback(
    async (title) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const existing = await db.tasks.where('dueDate').equals(today).toArray()
      const clone = isClone({ title: trimmed, dueDate: today }, existing)

      await db.tasks.add({
        title: trimmed,
        dueDate: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
        isClone: clone,
      })
    },
    [today]
  )

  /**
   * Marks a task as done, awards XP to the player, and updates the streak.
   * Idempotent: silently no-ops if the task is already done.
   * @returns {Promise<number>} XP earned (0 for clone tasks)
   */
  const completeTask = useCallback(async (taskId) => {
    const task = await db.tasks.get(taskId)
    if (!task || task.status === 'done') return 0

    const xpEarned = taskXpReward(task)

    await db.transaction('rw', [db.tasks, db.players], async () => {
      await db.tasks.update(taskId, {
        status: 'done',
        completedAt: new Date().toISOString(),
      })

      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        streak: 0,
        lastActiveDate: null,
      }

      const streakUpdate = calcUpdatedStreak(player)

      await db.players.put({
        ...player,
        xp: player.xp + xpEarned,
        ...streakUpdate,
      })
    })

    return xpEarned
  }, [])

  return { tasks: tasks ?? [], addTask, completeTask }
}
