/**
 * Week key helpers (local timezone).
 *
 * A "week" starts on Monday. The weekKey is the LOCAL date of that Monday,
 * formatted as "week-YYYY-MM-DD". This avoids ISO week-number edge cases
 * (year boundaries, locale differences) while remaining human-readable.
 *
 * Example: for any date between Mon 2026-02-23 and Sun 2026-03-01,
 * the weekKey is "week-2026-02-23".
 */

import { localDateKey } from './dateKey.js'

/**
 * Returns the LOCAL YYYY-MM-DD date of the Monday that starts the current week.
 * @param {Date} [date=new Date()]
 * @returns {string} YYYY-MM-DD of Monday
 */
export function weekStartDate(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  const diff = (day + 6) % 7 // days since Monday: Mon→0, Tue→1 … Sun→6
  d.setDate(d.getDate() - diff)
  return localDateKey(d)
}

/**
 * Returns the weekKey for the given date (defaults to today).
 * Format: "week-YYYY-MM-DD" where the date is the Monday of that week.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getWeekKey(date = new Date()) {
  return `week-${weekStartDate(date)}`
}

/**
 * Returns an array of YYYY-MM-DD strings for all 7 days in the week
 * that contains `date` (Mon → Sun).
 * @param {Date} [date=new Date()]
 * @returns {string[]}
 */
export function weekDays(date = new Date()) {
  const monday = new Date(date)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day + 6) % 7)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return localDateKey(d)
  })
}
