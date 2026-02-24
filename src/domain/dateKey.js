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

/**
 * Returns a YYYY-MM-DD dateKey offset by `days` from a base date.
 * Uses LOCAL timezone arithmetic to avoid DST surprises.
 * @param {number} days  Positive = future, negative = past.
 * @param {Date} [base=new Date()]
 * @returns {string}
 */
export function offsetDateKey(days, base = new Date()) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

/**
 * Parses a YYYY-MM-DD string into a LOCAL-timezone Date (midnight).
 * Avoids the UTC-midnight pitfall of `new Date('YYYY-MM-DD')`.
 * @param {string} key
 * @returns {Date}
 */
export function parseLocalDate(key) {
  const [y, m, d] = key.split('-')
  return new Date(+y, +m - 1, +d)
}

const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_SHORT_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Formats a YYYY-MM-DD key as a Spanish human-readable label.
 * Example: "2026-02-24" → "Lunes, 24 Feb 2026"
 * @param {string} key
 * @returns {string}
 */
export function formatDateLabel(key) {
  const date = parseLocalDate(key)
  const [, m, d] = key.split('-')
  return `${WEEKDAYS_ES[date.getDay()]}, ${+d} ${MONTHS_SHORT_ES[+m - 1]} ${date.getFullYear()}`
}
