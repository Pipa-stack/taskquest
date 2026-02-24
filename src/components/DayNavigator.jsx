import { formatDateLabel, offsetDateKey, todayKey } from '../domain/dateKey.js'

/** How far back/forward the user can navigate from today. */
const MAX_PAST_DAYS = 30
const MAX_FUTURE_DAYS = 365

/**
 * Day navigation bar: ← [Formatted date] →
 *
 * @param {{
 *   dateKey: string,          // YYYY-MM-DD currently selected
 *   onPrev: () => void,
 *   onNext: () => void,
 * }} props
 */
export default function DayNavigator({ dateKey, onPrev, onNext }) {
  const today = todayKey()
  const minDateKey = offsetDateKey(-MAX_PAST_DAYS)
  const maxDateKey = offsetDateKey(MAX_FUTURE_DAYS)

  const canGoPrev = dateKey > minDateKey
  const canGoNext = dateKey < maxDateKey

  return (
    <div className="day-navigator" role="group" aria-label="Navegación de día">
      <button
        className="day-nav-btn"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Día anterior"
      >
        &#8592;
      </button>

      <span className="day-nav-label">
        {formatDateLabel(dateKey)}
        {dateKey === today && <span className="day-nav-today"> · Hoy</span>}
      </span>

      <button
        className="day-nav-btn"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Día siguiente"
      >
        &#8594;
      </button>
    </div>
  )
}
