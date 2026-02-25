import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { XP_PER_LEVEL } from '../domain/gamification.js'
import { todayKey } from '../domain/dateKey.js'
import * as taskRepository from '../repositories/taskRepository.js'
import * as playerRepository from '../repositories/playerRepository.js'

/**
 * Displays player level, XP progress bar (animated), daily streak,
 * daily goal progress, and combo badge.
 *
 * DB access is fully delegated to taskRepository and playerRepository.
 */
export default function PlayerStats({ xp, level, streak, xpToNext, combo, dailyGoal }) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  const today = todayKey()

  // Count today's completed tasks live via repository
  const todayDone = useLiveQuery(
    () => taskRepository.countByDateAndStatus(today, 'done'),
    [today]
  ) ?? 0

  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct = dailyGoal > 0 ? Math.round((goalProgress / dailyGoal) * 100) : 0
  const goalMet = todayDone >= dailyGoal

  const showCombo = combo > 1.0

  const handleGoalChange = async (e) => {
    await playerRepository.setDailyGoal(Number(e.target.value))
  }

  return (
    <div className="player-stats">
      <h2 className="stats-title">HUD</h2>

      {/* Combo badge */}
      {showCombo && (
        <motion.div
          className="combo-badge"
          key={combo}
          initial={{ scale: 1.3, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          COMBO ×{combo.toFixed(1)}
        </motion.div>
      )}

      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Nivel</span>
          <motion.span
            className="stat-value"
            key={level}
            initial={{ scale: 1.4, color: '#a78bfa' }}
            animate={{ scale: 1, color: '#e2e2e7' }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            {level}
          </motion.span>
        </div>
        <div className="stat">
          <span className="stat-label">XP Total</span>
          <span className="stat-value">{xp}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Racha</span>
          <span className="stat-value">{streak} 🔥</span>
        </div>
      </div>

      <div
        className="xp-bar-wrap"
        title={`${xpIntoLevel} / ${XP_PER_LEVEL} XP para el siguiente nivel`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`XP: ${xpIntoLevel} de ${XP_PER_LEVEL}`}
      >
        <motion.div
          className="xp-bar"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
      <p className="xp-hint">{xpToNext} XP para nivel {level + 1}</p>

      {/* Daily Goal */}
      <div className="daily-goal">
        <div className="daily-goal-header">
          <span className="daily-goal-label">
            Objetivo diario: {goalProgress}/{dailyGoal}
            {goalMet && <span className="goal-met"> ✓</span>}
          </span>
          <select
            className="goal-select"
            value={dailyGoal}
            onChange={handleGoalChange}
            aria-label="Cambiar objetivo diario"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div
          className="daily-goal-bar-wrap"
          role="progressbar"
          aria-valuenow={goalPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Objetivo: ${goalProgress} de ${dailyGoal} tareas`}
        >
          <motion.div
            className={`daily-goal-bar ${goalMet ? 'goal-bar-done' : ''}`}
            animate={{ width: `${goalPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
      </div>
    </div>
  )
}
