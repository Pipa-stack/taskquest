import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { aggregateLast7Days, getTodayStats } from '../domain/stats.js'
import { todayKey } from '../domain/dateKey.js'

/**
 * Stats tab – shows XP today, tasks today, streak, and a 7-day table.
 */
export default function StatsTab({ streak }) {
  const today = todayKey()

  const allTasks = useLiveQuery(
    () => db.tasks.toArray(),
    []
  )

  if (!allTasks) {
    return <div className="stats-loading">Cargando estadísticas…</div>
  }

  const rows = aggregateLast7Days(allTasks)
  const todayStats = getTodayStats(rows, today)

  return (
    <div className="stats-tab">
      <h2 className="section-heading">Estadísticas</h2>

      <div className="stats-summary">
        <div className="stat-card">
          <span className="stat-card-label">XP hoy</span>
          <span className="stat-card-value">{todayStats.xp}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Tareas hoy</span>
          <span className="stat-card-value">{todayStats.tasks}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Racha</span>
          <span className="stat-card-value">{streak} 🔥</span>
        </div>
      </div>

      <h3 className="stats-table-heading">Últimos 7 días</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tareas</th>
            <th>XP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date} className={row.date === today ? 'stats-today' : ''}>
              <td>{row.date}</td>
              <td>{row.tasks}</td>
              <td>{row.xp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
