import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { getMonthMatrix, monthLabel } from '../domain/calendar.js'
import { localDateKey } from '../domain/dateKey.js'

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Mini monthly calendar grid.
 *
 * Props:
 *  - selectedDateKey  {string}   Currently selected YYYY-MM-DD date.
 *  - todayKey         {string}   Real today's YYYY-MM-DD (for highlight ring).
 *  - onSelectDateKey  {Function} Called with a YYYY-MM-DD string when a day is clicked.
 */
export default function MiniCalendar({ selectedDateKey, todayKey, onSelectDateKey }) {
  // viewKey is always the 1st of the visible month ("YYYY-MM-01")
  const toMonthStart = (dk) => dk.slice(0, 7) + '-01'

  const [viewKey, setViewKey] = useState(() => toMonthStart(selectedDateKey))

  // When selectedDateKey moves to a different month, sync the view
  useEffect(() => {
    setViewKey((current) => {
      const newStart = toMonthStart(selectedDateKey)
      return current.slice(0, 7) !== selectedDateKey.slice(0, 7) ? newStart : current
    })
  }, [selectedDateKey])

  // Derive range for the Dexie query from viewKey
  const viewYM = viewKey.slice(0, 7) // "YYYY-MM"
  const [viewYear, viewMonth] = viewYM.split('-').map(Number)
  const daysInViewMonth = new Date(viewYear, viewMonth, 0).getDate()
  const startKey = viewKey // "YYYY-MM-01"
  const endKey = `${viewYM}-${String(daysInViewMonth).padStart(2, '0')}`

  // Single range query → reduce to {dueDate: {pending, done}} in memory
  const tasksByDate = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .between(startKey, endKey, true, true)
        .toArray()
        .then((tasks) => {
          const map = {}
          for (const t of tasks) {
            if (!map[t.dueDate]) map[t.dueDate] = { pending: 0, done: 0 }
            if (t.status === 'pending') map[t.dueDate].pending += 1
            else if (t.status === 'done') map[t.dueDate].done += 1
          }
          return map
        }),
    [startKey, endKey],
  )

  const matrix = getMonthMatrix(viewKey)

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 2, 1) // one month back
    setViewKey(localDateKey(d))
  }

  function nextMonth() {
    const d = new Date(viewYear, viewMonth, 1) // one month forward
    setViewKey(localDateKey(d))
  }

  return (
    <div className="mini-calendar">
      {/* Header: « Mes Año » */}
      <div className="mc-header">
        <button className="mc-nav" onClick={prevMonth} aria-label="Mes anterior">
          «
        </button>
        <span className="mc-title">{monthLabel(viewKey)}</span>
        <button className="mc-nav" onClick={nextMonth} aria-label="Mes siguiente">
          »
        </button>
      </div>

      {/* Grid */}
      <div className="mc-grid">
        {/* Day-of-week header row */}
        {DAY_LABELS.map((d) => (
          <div key={d} className="mc-day-label">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {matrix.flat().map((dk, i) => {
          if (!dk) {
            return <div key={`pad-${i}`} className="mc-cell mc-cell-empty" aria-hidden="true" />
          }

          const isToday = dk === todayKey
          const isSelected = dk === selectedDateKey
          const info = tasksByDate?.[dk]
          const hasDone = (info?.done ?? 0) > 0
          const hasPending = (info?.pending ?? 0) > 0

          const cls = ['mc-cell', isToday && 'mc-today', isSelected && 'mc-selected']
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={dk}
              className={cls}
              onClick={() => onSelectDateKey(dk)}
              aria-label={dk}
              aria-pressed={isSelected}
              type="button"
            >
              <span className="mc-day-num">{Number(dk.slice(8))}</span>
              {(hasDone || hasPending) && (
                <span className="mc-dots">
                  {hasDone && <span className="mc-dot mc-dot-done" />}
                  {hasPending && <span className="mc-dot mc-dot-pending" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
