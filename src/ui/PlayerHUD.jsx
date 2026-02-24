import { getXpProgress } from '../domain/gamification.js'

export default function PlayerHUD({ player }) {
  if (!player) return null

  const { current, next, progress, xpInLevel, xpNeeded } = getXpProgress(player.xp)

  return (
    <div className="hud">
      <div className="hud__level">
        <span className="hud__level-num">Nv. {player.level}</span>
        <span className="hud__level-title">{current.title}</span>
      </div>

      <div className="hud__xp">
        <div className="xp-bar__labels">
          <span>{player.xp} XP total</span>
          {next && <span>{xpInLevel} / {xpNeeded} para nv. {next.level}</span>}
        </div>
        <div className="xp-bar__track">
          <div className="xp-bar__fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`hud__streak ${player.streak > 0 ? 'hud__streak--active' : ''}`}>
        <span className="hud__streak-icon">🔥</span>
        <span className="hud__streak-count">{player.streak}</span>
        <span className="hud__streak-label">racha</span>
      </div>
    </div>
  )
}
