import { XP_PER_LEVEL } from '../domain/gamification.js'

/**
 * Displays player level, XP progress, and daily streak.
 */
export default function PlayerStats({ xp, level, streak, xpToNext }) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  return (
    <div className="player-stats">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Level</span>
          <span className="stat-value">{level}</span>
        </div>
        <div className="stat">
          <span className="stat-label">XP</span>
          <span className="stat-value">{xp}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{streak}🔥</span>
        </div>
      </div>
      <div className="xp-bar-wrap" title={`${xpIntoLevel} / ${XP_PER_LEVEL} XP to next level`}>
        <div className="xp-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="xp-hint">{xpToNext} XP to level {level + 1}</p>
    </div>
  )
}
