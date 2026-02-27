import { motion } from 'framer-motion'
import { XP_PER_LEVEL } from '../domain/gamification.js'
import { getCharacter } from '../domain/characters.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * Displays player level, XP progress bar (animated), daily streak,
 * daily goal progress, combo badge, active team, and idle farming stats.
 */
export default function PlayerStats({
  xp, level, streak, xpToNext, combo, dailyGoal, syncStatus, activeTeam,
  coins, energy, energyCap, boosts, coinsPerMinuteBase,
  currentZone, powerScore,
  onNotify, onNavigateToMap,
}) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  const today = todayKey()

  // Count today's completed tasks live
  const todayDone = useLiveQuery(
    () => db.tasks.where('[dueDate+status]').equals([today, 'done']).count(),
    [today]
  ) ?? 0

  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct = dailyGoal > 0 ? Math.round((goalProgress / dailyGoal) * 100) : 0
  const goalMet = todayDone >= dailyGoal

  const showCombo = combo > 1.0

  // Idle farming derived values
  const nowMs = Date.now()
  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
  const effectiveEnergyCap = applyBoostsToCaps(energyCap ?? 100, activeBoostList)
  const energyPct = effectiveEnergyCap > 0 ? Math.round(((energy ?? 100) / effectiveEnergyCap) * 100) : 100

  // Find the active coin boost with the highest multiplier (for display)
  const activeCoinBoost = activeBoostList
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  const handleGoalChange = async (e) => {
    const newGoal = Number(e.target.value)
    await playerRepository.setDailyGoal(newGoal)
  }

  const handleTickIdle = async () => {
    const { coinsEarned } = await playerRepository.tickIdle(Date.now(), 1, true)
    if (onNotify) {
      if (coinsEarned > 0) {
        onNotify(`+${coinsEarned} monedas reclamadas`)
      } else {
        onNotify('Sin monedas que reclamar (sin energía o muy pronto)')
      }
    }
  }

  return (
    <div className="player-stats">
      <h2 className="stats-title">
        HUD
        {syncStatus === 'pending' && (
          <span className="player-sync-icon" title="Sincronización pendiente"> ⏳</span>
        )}
        {syncStatus === 'error' && (
          <span className="player-sync-icon" title="Error de sincronización"> ⚠️</span>
        )}
      </h2>

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

      {/* Idle farming section */}
      <div className="idle-section">
        {/* Coins */}
        <div className="idle-row">
          <span className="idle-label">🪙 Monedas:</span>
          <span className="idle-value">{coins ?? 0}</span>
        </div>
        <div className="idle-row">
          <span className="idle-label">Monedas/min:</span>
          <span className="idle-value">
            {coinsPerMinuteBase ?? 1}
            {activeCoinBoost && (
              <span className="boost-active-badge"> ×{activeCoinBoost.coinMultiplier}</span>
            )}
          </span>
        </div>

        {/* Energy bar */}
        <div className="idle-energy">
          <div className="idle-energy-header">
            <span className="idle-label">⚡ Energía:</span>
            <span className="idle-value">{Math.floor(energy ?? 100)}/{effectiveEnergyCap}</span>
          </div>
          <div
            className="energy-bar-wrap"
            role="progressbar"
            aria-valuenow={energyPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Energía: ${Math.floor(energy ?? 100)} de ${effectiveEnergyCap}`}
          >
            <motion.div
              className="energy-bar"
              animate={{ width: `${energyPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
        </div>

        {/* Active boost display */}
        {activeCoinBoost && (() => {
          const boostDef = getBoost(activeCoinBoost.id)
          const remainingMs = activeCoinBoost.expiresAt - nowMs
          const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000))
          return (
            <div className="boost-active-info">
              🚀 {boostDef?.label ?? activeCoinBoost.id} — {remainingMin}m restantes
            </div>
          )
        })()}

        {/* Claim idle button */}
        <button
          className="idle-claim-btn"
          onClick={handleTickIdle}
          type="button"
          title="Reclamar monedas acumuladas desde el último tick"
        >
          Reclamar idle
        </button>
      </div>

      {/* Zone & Power info */}
      <div className="hud-zone-row">
        <span className="hud-zone-label">
          📍 Zona <strong>{currentZone ?? 1}</strong>
        </span>
        <span className="hud-power-label">
          ⚡ <strong>{powerScore ?? 0}</strong> power
        </span>
        {onNavigateToMap && (
          <button
            className="hud-map-btn"
            onClick={onNavigateToMap}
            type="button"
            title="Abrir mapa de zonas"
          >
            🗺️ Mapa
          </button>
        )}
      </div>

      {/* Active Team */}
      <div className="hud-team">
        <span className="hud-team-label">Equipo:</span>
        {activeTeam && activeTeam.length > 0 ? (
          <span className="hud-team-emojis">
            {activeTeam.map((id) => {
              const char = getCharacter(id)
              return char ? (
                <span key={id} className="hud-team-emoji" title={char.name}>
                  {char.emoji}
                </span>
              ) : null
            })}
          </span>
        ) : (
          <span className="hud-team-empty">0/3</span>
        )}
      </div>

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
