import { motion } from 'framer-motion'
import { XP_PER_LEVEL } from '../domain/gamification.js'
import { getCharacter } from '../domain/characters.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import { computeTalentBonuses } from '../domain/talents.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * Compact sidebar HUD — two blocks: Progreso + Estado.
 * Shows level/XP/streak/combo, then coins/energy/zone/power/team/boost.
 * Daily-goal selector removed — lives in BaseDashboard instead.
 */
export default function PlayerStats({
  xp, level, streak, xpToNext, combo, syncStatus, activeTeam,
  coins, energy, energyCap, boosts, coinsPerMinuteBase,
  currentZone, powerScore,
  onNotify, onNavigateToMap,
}) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  const showCombo = combo > 1.0

  const nowMs = Date.now()
  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
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

  const handleTickIdle = async () => {
    const { coinsEarned } = await playerRepository.tickIdle(Date.now())
    if (onNotify) {
      onNotify(coinsEarned > 0
        ? `+${coinsEarned} monedas reclamadas`
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

      {/* ── BLOQUE 1: Progreso ──────────────────────────────────── */}
      <div className="hud-block">
        <p className="hud-block-title">Progreso</p>

        {/* Level + Racha + Combo chips */}
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

          {showCombo && (
            <motion.div
              className="combo-badge"
              key={combo}
              initial={{ scale: 1.3, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              title="Completa tareas seguidas para mantener el combo y multiplicar el XP obtenido"
            >
              COMBO ×{combo.toFixed(1)}
            </motion.div>
          )}
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
      </div>

      {/* ── BLOQUE 2: Estado ─────────────────────────────────────── */}
      <div className="hud-block">
        <p className="hud-block-title">Estado</p>

        {/* Coins + CPM row */}
        <div className="hud-chips-row">
          <div className="hud-chip">
            <span className="hud-chip-label">🪙 Monedas</span>
            <span className="hud-chip-value hud-chip-value--gold">{coins ?? 0}</span>
          </div>
          <div className="hud-chip">
            <span className="hud-chip-label">Monedas/min</span>
            <span className="hud-chip-value hud-chip-value--cyan">
              {cpmDisplay}
              {activeCoinBoost && (
                <span className="boost-active-badge"> ×{activeCoinBoost.coinMultiplier}</span>
              )}
            </span>
          </div>
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
      </div>

    </div>
  )
}
