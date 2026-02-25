/**
 * Calendar helpers for the MiniCalendar component.
 *
 * All functions are pure (no side-effects, no I/O) to keep them easy to test.
 *
 * Week layout: Monday = first column (index 0), Sunday = last column (index 6).
 * This matches the European/ISO standard used in Spain.
 */

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Returns a matrix (array of weeks) for the month containing `dateKey`.
 * Each week is an array of exactly 7 elements: a YYYY-MM-DD dateKey for days
 * belonging to the month, or `null` for padding cells before/after the month.
 *
 * The matrix always has between 4 and 6 rows (never exceeds 6).
 *
 * @param {string} dateKey - Any YYYY-MM-DD date within the desired month.
 * @returns {Array<Array<string|null>>}
 */
export function getMonthMatrix(dateKey) {
  const [yearStr, monthStr] = dateKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) // 1-based

  // Day of week of the 1st of the month (0=Sun … 6=Sat in JS getDay())
  // Convert to Monday-first: Mon=0, Tue=1, …, Sun=6
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7

  // Number of days in the month
  const daysInMonth = new Date(year, month, 0).getDate()

  // Build a flat array of cells: null-padding + day dateKeys + null-padding
  const cells = []

  for (let i = 0; i < firstDow; i++) {
    cells.push(null)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${yearStr}-${monthStr.padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    )
  }

  // Pad end to complete the last week
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  // Slice into weeks of 7
  const matrix = []
  for (let i = 0; i < cells.length; i += 7) {
    matrix.push(cells.slice(i, i + 7))
  }

  return matrix
}

/**
 * Returns a human-readable month label in Spanish.
 *
 * @param {string} dateKey - Any YYYY-MM-DD date within the desired month.
 * @returns {string} e.g. "Febrero 2026"
 */
export function monthLabel(dateKey) {
  const [yearStr, monthStr] = dateKey.split('-')
  return `${MONTH_NAMES_ES[Number(monthStr) - 1]} ${yearStr}`
}
