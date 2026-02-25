import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { todayKey } from '../domain/dateKey.js'
import * as taskRepository from '../repositories/taskRepository.js'

/**
 * React hook that exposes tasks for a given date and mutation helpers.
 *
 * DB access is fully delegated to taskRepository — this hook never imports db.
 * Reactivity is preserved via useLiveQuery wrapping repository query functions
 * (Dexie tracks all table reads that happen inside the callback).
 *
 * @param {string} [selectedDate] - YYYY-MM-DD date to show tasks for.
 *   Defaults to today. Streak / achievement logic always uses the real today.
 *
 * Returns:
 *  - tasks        – live-reactive array of tasks for `selectedDate`
 *  - addTask      – create a new task for `selectedDate`; auto-detects clones
 *  - completeTask – marks a task done, applies combo XP, checks achievements
 *                   Returns Promise<{ xpEarned, newAchievements }>
 *  - dateKey      – resolved YYYY-MM-DD string for the selected date
 */
export function useTasks(selectedDate) {
  const today = todayKey()
  const dateKey = selectedDate || today

  const tasks = useLiveQuery(
    () => taskRepository.getByDate(dateKey),
    [dateKey]
  )

  const addTask = useCallback(
    async (title) => {
      await taskRepository.create({ title, dueDate: dateKey })
    },
    [dateKey]
  )

  const completeTask = useCallback(
    async (taskId) => taskRepository.complete(taskId),
    []
  )

  return { tasks: tasks ?? [], addTask, completeTask, dateKey }
}
