import { motion } from 'framer-motion'
import { XP_PER_LEVEL } from '../domain/gamification.js'

/**
 * Displays player level, XP progress bar (animated), and daily streak.
 */
export default function PlayerStats({ xp, level, streak, xpToNext }) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  return (
    <div className="player-stats">
      <h2 className="stats-title">HUD</h2>
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
    </div>
  )
}
