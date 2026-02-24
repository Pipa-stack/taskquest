import { create } from 'zustand'
import { taskRepository }   from '../data/taskRepository.js'
import { playerRepository } from '../data/playerRepository.js'
import { createTaskData }   from '../domain/tasks.js'
import {
  getLevelFromXp,
  calculateStreakBonus,
} from '../domain/gamification.js'
import { computeNewStreak } from '../domain/streak.js'

const useStore = create((set, get) => ({
  tasks:        [],
  player:       null,
  isLoading:    true,
  notification: null,

  /**
   * Bootstrap: load today's tasks and the player record from IndexedDB.
   * Safe to call multiple times (idempotent reads).
   */
  initialize: async () => {
    const [tasks, player] = await Promise.all([
      taskRepository.getToday(),
      playerRepository.get(),
    ])
    set({ tasks, player, isLoading: false })
  },

  /** Create a new task and prepend it to the local list. */
  createTask: async (title, difficulty) => {
    const data = createTaskData(title, difficulty)
    const task = await taskRepository.create(data)
    set((state) => ({ tasks: [task, ...state.tasks] }))
  },

  /**
   * Complete a task:
   *  1. Persist completion in DB
   *  2. Compute XP gain (base + streak bonus)
   *  3. Derive new level from total XP
   *  4. Update streak & lastActiveDate
   *  5. Push notification that auto-dismisses after 3 s
   */
  completeTask: async (taskId) => {
    const { player, tasks } = get()
    if (!player) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === 'completed') return

    await taskRepository.complete(taskId)

    const today       = new Date().toISOString().split('T')[0]
    const newStreak   = computeNewStreak(player.streak, player.lastActiveDate)
    const streakBonus = calculateStreakBonus(newStreak)
    const xpGained    = task.xpReward + streakBonus
    const newXp       = player.xp + xpGained
    const newLevelCfg = getLevelFromXp(newXp)
    const leveledUp   = newLevelCfg.level > player.level

    const updatedPlayer = await playerRepository.update({
      xp:             newXp,
      level:          newLevelCfg.level,
      streak:         newStreak,
      lastActiveDate: today,
    })

    const notificationId = Date.now()

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
          : t
      ),
      player: updatedPlayer,
      notification: {
        id: notificationId,
        xpGained,
        streakBonus,
        leveledUp,
        newLevel: leveledUp ? newLevelCfg : null,
      },
    }))

    setTimeout(
      () =>
        set((state) =>
          state.notification?.id === notificationId
            ? { notification: null }
            : state
        ),
      3000
    )
  },
}))

export default useStore
