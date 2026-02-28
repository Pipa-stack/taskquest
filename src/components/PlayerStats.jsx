import { motion } from 'framer-motion'
import { XP_PER_LEVEL } from '../domain/gamification.js'
import { getCharacter } from '../domain/characters.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import { computeTalentBonuses } from '../domain/talents.js'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { playerRepository } from '../repositories/playerRepository.js'
import { getActiveEvents } from '../domain/events.js'

/**
 * Compact sidebar HUD — chips + bars layout.
 * Shows level/XP, streak, coins, energy, CPM, zone, power, team, daily goal.
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
  const { daily: dailyEvent, weekly: weeklyEvent } = getActiveEvents(today)
  const todayDone = useLiveQuery(
    () => db.tasks.where('[dueDate+status]').equals([today, 'done']).count(),
    [today]
  ) ?? 0

  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct = dailyGoal > 0 ? Math.round((goalProgress / dailyGoal) * 100) : 0
  const goalMet = todayDone >= dailyGoal

  const showCombo = combo > 1.0

  const nowMs = Date.now()
  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
  const talentBonuses = computeTalentBonuses({})
  const effectiveEnergyCap = applyBoostsToCaps(energyCap ?? 100, activeBoostList)
  const energyPct = effectiveEnergyCap > 0
    ? Math.round(((energy ?? 0) / effectiveEnergyCap) * 100)
    : 0

  const activeCoinBoost = activeBoostList
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  const cpmDisplay = activeCoinBoost
    ? ((coinsPerMinuteBase ?? 1) * activeCoinBoost.coinMultiplier).toFixed(1)
    : (coinsPerMinuteBase ?? 1)

  const handleGoalChange = async (e) => {
    await playerRepository.setDailyGoal(Number(e.target.value))
  }

  const handleTickIdle = async () => {
    const { coinsEarned, freeClaimUsed } = await playerRepository.tickIdle(Date.now(), 1, { fromManual: true })
    if (onNotify) {
      const suffix = freeClaimUsed ? ' (sin gastar energía 🔋)' : ''
      onNotify(coinsEarned > 0
        ? `+${coinsEarned} monedas reclamadas${suffix}`
        : 'Sin monedas que reclamar'
      )
    }
  }

  return (
    <div className="player-stats">
      <p className="stats-title">
        HUD
        {syncStatus === 'pending' && <span className="player-sync-icon" title="Sync pendiente"> ⏳</span>}
        {syncStatus === 'error'   && <span className="player-sync-icon" title="Error de sync"> ⚠️</span>}
      </p>

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

      {/* Level + streak chips */}
      <div className="hud-chips-row">
        <div className="hud-chip">
          <span className="hud-chip-label">Nivel</span>
          <motion.span
            className="hud-chip-value"
            key={level}
            initial={{ scale: 1.4, color: '#a78bfa' }}
            animate={{ scale: 1, color: '#e2e2e7' }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            {level}
          </motion.span>
        </div>
        <div className="hud-chip">
          <span className="hud-chip-label">Racha</span>
          <span className="hud-chip-value">{streak} 🔥</span>
        </div>
        <div className="hud-chip">
          <span className="hud-chip-label">🪙 Monedas</span>
          <span className="hud-chip-value hud-chip-value--gold">{coins ?? 0}</span>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div
          className="xp-bar-wrap"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP: ${xpIntoLevel} de ${XP_PER_LEVEL}`}
          title={`${xpIntoLevel} / ${XP_PER_LEVEL} XP`}
        >
          <motion.div
            className="xp-bar"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            style={{ minWidth: pct > 0 ? 4 : 0 }}
          />
        </div>
        <p className="xp-hint">{xpToNext} XP → lv {level + 1}</p>
      </div>

      {/* Energy bar */}
      <div className="hud-energy-wrap">
        <div className="hud-energy-header">
          <span>⚡ Energía</span>
          <span>{Math.floor(energy ?? 0)}/{effectiveEnergyCap}</span>
        </div>
        <div
          className="energy-bar-wrap"
          role="progressbar"
          aria-valuenow={energyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Energía: ${Math.floor(energy ?? 0)} de ${effectiveEnergyCap}`}
        >
          <motion.div
            className="energy-bar"
            animate={{ width: `${energyPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            style={{ minWidth: energyPct > 0 ? 2 : 0 }}
          />
        </div>
      </div>

      {/* CPM chip */}
      <div className="hud-chips-row">
        <div className="hud-chip" style={{ flex: 2 }}>
          <span className="hud-chip-label">Monedas/min</span>
          <span className="hud-chip-value hud-chip-value--cyan">
            {cpmDisplay}
            {activeCoinBoost && (
              <span className="boost-active-badge"> ×{activeCoinBoost.coinMultiplier}</span>
            )}
          </span>
        </div>
      </div>

      {/* Active boost */}
      {activeCoinBoost && (() => {
        const boostDef = getBoost(activeCoinBoost.id)
        const remainingMin = Math.max(0, Math.ceil((activeCoinBoost.expiresAt - nowMs) / 60_000))
        return (
          <div className="boost-active-info">
            🚀 {boostDef?.label ?? activeCoinBoost.id} — {remainingMin}m
          </div>
        )
      })()}

      {/* Active event chip */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.72rem',
          fontWeight: 600,
          color: dailyEvent.tagColor,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '999px',
          padding: '0.2rem 0.55rem',
          marginBottom: '0.25rem',
          cursor: 'default',
        }}
        title={`Hoy: ${dailyEvent.title} | Semana: ${weeklyEvent.title}`}
      >
        🎉 {dailyEvent.icon} Evento activo
      </div>

      {/* Idle claim (compact) */}
      <button
        className="idle-claim-btn"
        onClick={handleTickIdle}
        type="button"
        title="Reclamar monedas acumuladas"
      >
        Reclamar idle
      </button>

      {/* Zone & Power */}
      <div className="hud-zone-row">
        <span className="hud-zone-label">📍 Zona <strong>{currentZone ?? 1}</strong></span>
        <span className="hud-power-label">⚡ <strong>{powerScore ?? 0}</strong></span>
        {onNavigateToMap && (
          <button
            className="hud-map-btn"
            onClick={onNavigateToMap}
            type="button"
            aria-label="Abrir mapa de zonas"
          >
            🗺️ Mapa
          </button>
        )}
      </div>

      {/* Active team */}
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

      {/* Daily goal */}
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
            style={{ minWidth: goalPct > 0 ? 4 : 0 }}
          />
        </div>
      </div>
    </div>
  )
}
