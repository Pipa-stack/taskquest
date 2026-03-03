import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { playerRepository } from '../repositories/playerRepository.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import { computeTalentBonuses } from '../domain/talents.js'
import { calcTeamMultiplier } from '../domain/idle.js'
import { CHARACTERS } from '../domain/characters.js'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'

const QUICK_ACTIONS = [
  { label: 'Boosts',         icon: '🚀', tab: 'Boosts' },
  { label: 'Colección',      icon: '👥', tab: 'Colección' },
  { label: 'Mapa',           icon: '🗺️', tab: 'Mapa' },
  { label: 'Talentos',       icon: '🌟', tab: 'Talentos' },
  { label: 'Estadísticas',   icon: '📊', tab: 'Stats' },
]

/**
 * Home dashboard — hero idle stats, Reclamar CTA, daily goal, status grid, quick nav.
 * Hierarchy: Producción (coins + energy + claim) → Daily goal → Estado → Quick actions.
 */
export default function BaseDashboard({ player, powerScore, onNotify, onNavigateTo }) {
  const [claimState, setClaimState] = useState(null) // null | 'claimed' | 'empty'

  const today = todayKey()
  const todayDone = useLiveQuery(
    () => db.tasks.where('[dueDate+status]').equals([today, 'done']).count(),
    [today]
  ) ?? 0

  // ── Derived idle values ──────────────────────────────────────────
  const nowMs = Date.now()
  const boosts = player.boosts ?? []
  const activeBoosts = getActiveBoosts(boosts, nowMs)
  const talentBonuses = computeTalentBonuses(player.talents ?? {})
  const effectiveEnergyCap = applyBoostsToCaps(
    (player.energyCap ?? 100) + talentBonuses.energyCapBonus,
    activeBoosts
  )
  const energy = player.energy ?? 0
  const energyPct = effectiveEnergyCap > 0
    ? Math.min(100, (energy / effectiveEnergyCap) * 100)
    : 0

  // Active coin boost
  const activeCoinBoost = activeBoosts
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  // Multipliers (kept for title tooltip — not shown inline)
  const teamMult   = calcTeamMultiplier(player.activeTeam ?? [], {}, CHARACTERS)
  const boostMult  = activeCoinBoost?.coinMultiplier ?? 1
  const talentMult = talentBonuses.idleCoinMult ?? 1
  const cpmBase    = player.coinsPerMinuteBase ?? 1
  const cpmTotal   = cpmBase * teamMult * boostMult * talentMult

  // Daily goal
  const dailyGoal    = player.dailyGoal ?? 3
  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct      = dailyGoal > 0 ? (goalProgress / dailyGoal) * 100 : 0
  const goalMet      = todayDone >= dailyGoal

  // Active boost display
  const activeCoinBoostDef    = activeCoinBoost ? getBoost(activeCoinBoost.id) : null
  const boostRemainingMin     = activeCoinBoost
    ? Math.max(0, Math.ceil((activeCoinBoost.expiresAt - nowMs) / 60_000))
    : 0

  const canClaim = energy > 0 && !claimState

  const handleClaim = async () => {
    if (claimState) return
    const { coinsEarned } = await playerRepository.tickIdle(nowMs)
    if (coinsEarned > 0) {
      setClaimState('claimed')
      onNotify?.(`+${coinsEarned} monedas reclamadas`)
      setTimeout(() => setClaimState(null), 2500)
    } else {
      setClaimState('empty')
      onNotify?.('Sin monedas que reclamar (sin energía o muy reciente)')
      setTimeout(() => setClaimState(null), 1500)
    }
  }

  // Claim button states
  const claimClass = [
    'btn-claim',
    canClaim && claimState === null ? 'btn-claim--ready' : '',
    claimState === 'claimed'        ? 'btn-claim--claimed' : '',
  ].filter(Boolean).join(' ')

  const claimLabel =
    claimState === 'claimed' ? '✓ ¡Reclamado!'   :
    claimState === 'empty'   ? 'Nada pendiente'   :
    energy <= 0              ? 'Sin energía'       :
                               'Reclamar monedas'

  // Breakdown tooltip: only shown on hover over CPM text
  const cpmTooltip =
    `Desglose: Base ${cpmBase} × Equipo ×${teamMult.toFixed(2)}` +
    (boostMult  > 1 ? ` × Boost ×${boostMult}`              : '') +
    (talentMult > 1 ? ` × Talento ×${talentMult.toFixed(2)}` : '')

  return (
    <div className="base-dashboard">

      {/* ── 1. HERO CARD — Producción ──────────────────────────────── */}
      <div className="base-hero-card card">

        {/* Coins — elemento más prominente */}
        <div className="hero-production">
          <div className="hero-coins-group">
            <span className="hero-coin-icon" aria-hidden="true">🪙</span>
            <motion.span
              className="hero-coins"
              key={player.coins}
              initial={{ scale: 1.15, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {player.coins ?? 0}
            </motion.span>
          </div>

          {/* CPM — información secundaria; el desglose va en el tooltip */}
          <p className="hero-cpm" title={cpmTooltip}>
            +{cpmTotal.toFixed(1)} monedas / minuto
          </p>
        </div>

        {/* Barra de energía — más gruesa y prominente */}
        <div className="hero-energy-block">
          <div className="hero-energy-label-row">
            <span>⚡ Energía</span>
            <span>{Math.floor(energy)} / {effectiveEnergyCap}</span>
          </div>
          <div
            className="hero-energy-bar"
            role="progressbar"
            aria-valuenow={Math.round(energyPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Energía: ${Math.floor(energy)} de ${effectiveEnergyCap}`}
          >
            <motion.div
              className="hero-energy-fill"
              animate={{ width: `${energyPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              style={{ minWidth: energyPct > 0 ? 4 : 0 }}
            />
          </div>
        </div>

        {/* CTA — botón principal */}
        <button
          className={claimClass}
          onClick={handleClaim}
          disabled={energy <= 0 || !!claimState}
          type="button"
          aria-label="Reclamar monedas idle acumuladas"
        >
          {claimLabel}
        </button>

      </div>

      {/* ── 2. OBJETIVO DEL DÍA — antes del estado ─────────────────── */}
      <div className="base-daily card">
        <div className="daily-loop-header">
          <span className="daily-loop-title">🎯 Objetivo del día</span>
          <span className={`daily-loop-count${goalMet ? ' daily-loop-count--met' : ''}`}>
            {goalProgress} / {dailyGoal} tareas{goalMet ? ' ✓' : ''}
          </span>
        </div>

        {/* Barra de progreso prominente */}
        <div
          className="progress-wrap progress-wrap--lg"
          role="progressbar"
          aria-valuenow={Math.round(goalPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Objetivo del día: ${goalProgress} de ${dailyGoal} tareas completadas`}
        >
          <motion.div
            className={`progress-fill${goalMet ? ' progress-fill--done' : ''}`}
            animate={{ width: `${goalPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            style={{ minWidth: goalPct > 0 ? 4 : 0 }}
          />
        </div>

        {/* Chips individuales — referencia visual secundaria */}
        <div className="daily-chips">
          {Array.from({ length: dailyGoal }, (_, i) => (
            <span
              key={i}
              className={`daily-chip${i < todayDone ? ' daily-chip--done' : ''}`}
            >
              {i < todayDone ? '✓' : `${i + 1}`}
            </span>
          ))}
        </div>

        {goalMet && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--c-success)', fontWeight: 600 }}
          >
            ¡Objetivo cumplido! 🎉
          </motion.p>
        )}
      </div>

      {/* ── 3. ESTADO ACTUAL — grid 2×2 ────────────────────────────── */}
      <div className="base-status card">
        <p className="base-status-title">Estado actual</p>
        <div className="status-grid">

          <div className="stat-cell">
            <span className="stat-cell-label">Zona</span>
            <span className="stat-cell-value">📍 Zona {player.currentZone ?? 1}</span>
          </div>

          <div className="stat-cell">
            <span className="stat-cell-label">Power</span>
            <span className="stat-cell-value">⚡ {powerScore ?? 0}</span>
          </div>

          <div className="stat-cell">
            <span className="stat-cell-label">Equipo</span>
            <span className="stat-cell-value">
              👥 {(player.activeTeam ?? []).length} / 3
            </span>
          </div>

          <div className={`stat-cell${activeCoinBoost ? ' stat-cell--boost' : ''}`}>
            <span className="stat-cell-label">Boost activo</span>
            <span className="stat-cell-value">
              {activeCoinBoost
                ? `🚀 ${activeCoinBoostDef?.label ?? '—'} (${boostRemainingMin}m)`
                : <span style={{ color: 'var(--c-dim)' }}>—</span>
              }
            </span>
          </div>

        </div>
      </div>

      {/* ── 4. ACCIONES RÁPIDAS ─────────────────────────────────────── */}
      <div className="base-quick card">
        <p className="base-quick-title">Acciones rápidas</p>
        <div className="quick-actions-grid">
          {QUICK_ACTIONS.map(({ label, icon, tab }) => (
            <button
              key={tab}
              className="quick-action-btn"
              onClick={() => onNavigateTo?.(tab)}
              type="button"
              aria-label={`Ir a ${label}`}
            >
              <span className="quick-action-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
