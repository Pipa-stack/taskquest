/**
 * Stats aggregation for the Stats tab.
 * Uses localDateKey so dates are always LOCAL timezone.
 */
import { localDateKey } from './dateKey.js'

/**
 * Aggregates task completions for the last 7 days (today inclusive).
 *
 * @param {Array<{ status: string, dueDate: string, isClone?: boolean, completedAt?: string }>} allTasks
 * @param {Date} [now=new Date()]
 * @returns {Array<{ date: string, tasks: number, xp: number }>}  sorted oldest→newest
 */
export function aggregateLast7Days(allTasks, now = new Date()) {
  // Build ordered array of the last 7 date keys
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(localDateKey(d))
  }

  return days.map((date) => {
    const doneTasks = allTasks.filter(
      (t) => t.status === 'done' && t.dueDate === date
    )
    const tasks = doneTasks.length
    const xp = doneTasks.reduce((acc, t) => acc + (t.isClone ? 0 : 100), 0)
    return { date, tasks, xp }
  })
}

/**
 * Returns today's aggregate.
 * @param {ReturnType<aggregateLast7Days>} rows
 * @param {string} todayDate YYYY-MM-DD
 */
export function getTodayStats(rows, todayDate) {
  return rows.find((r) => r.date === todayDate) ?? { date: todayDate, tasks: 0, xp: 0 }
}
