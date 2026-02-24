/**
 * Local-timezone date helpers.
 *
 * WHY NOT toISOString()?
 *   Date.prototype.toISOString() always returns UTC. In timezones west of UTC
 *   (e.g. UTC-5) a local date of "today at 23:00" converts to "tomorrow" in UTC.
 *   This causes tasks and streaks to roll over at the wrong moment.
 *
 *   These helpers read getFullYear/getMonth/getDate which use the LOCAL timezone.
 */

/**
 * Returns a YYYY-MM-DD string in the LOCAL timezone.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns today's YYYY-MM-DD in LOCAL timezone. */
export function todayKey() {
  return localDateKey(new Date())
}

/** Returns yesterday's YYYY-MM-DD in LOCAL timezone. */
export function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateKey(d)
}
