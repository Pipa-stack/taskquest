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
import { getActiveEvents, canClaimEventBonus, getEventEffectLines } from '../domain/events.js'

const QUICK_ACTIONS = [
  { label: 'Boosts',    icon: '🚀', tab: 'Boosts' },
  { label: 'Colección', icon: '👥', tab: 'Colección' },
  { label: 'Mapa',      icon: '🗺️', tab: 'Mapa' },
  { label: 'Talentos',  icon: '🌟', tab: 'Talentos' },
  { label: 'Stats',     icon: '📊', tab: 'Stats' },
]

/**
 * Home dashboard — hero idle stats, Reclamar CTA, status chips, quick nav, daily loop.
 */
export default function BaseDashboard({ player, powerScore, onNotify, onNavigateTo }) {
  const [claimState, setClaimState] = useState(null) // null | 'claimed' | 'empty'
  const [eventClaimState, setEventClaimState] = useState(null) // null | 'claimed'

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

  // Multipliers for breakdown display
  const teamMult = calcTeamMultiplier(player.activeTeam ?? [], {}, CHARACTERS)
  const boostMult = activeCoinBoost?.coinMultiplier ?? 1
  const talentMult = talentBonuses.idleCoinMult ?? 1
  const cpmBase = player.coinsPerMinuteBase ?? 1
  const cpmTotal = cpmBase * teamMult * boostMult * talentMult

  // Active events (deterministic, no RNG)
  const activeEvents = getActiveEvents(today)
  const { daily: dailyEvent, weekly: weeklyEvent } = activeEvents
  const eventClaimAvailable = !eventClaimState && canClaimEventBonus(player, today) && todayDone >= 1

  const handleEventClaim = async () => {
    if (!eventClaimAvailable) return
    const bonus = await playerRepository.claimEventBonus(today, todayDone)
    if (bonus) {
      setEventClaimState('claimed')
      onNotify?.(`🎉 +${bonus} monedas por evento diario`)
      setTimeout(() => setEventClaimState(null), 3000)
    }
  }

  // Daily goal
  const dailyGoal = player.dailyGoal ?? 3
  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct = dailyGoal > 0 ? (goalProgress / dailyGoal) * 100 : 0
  const goalMet = todayDone >= dailyGoal

  // Active boost remaining time
  const activeCoinBoostDef = activeCoinBoost ? getBoost(activeCoinBoost.id) : null
  const boostRemainingMin = activeCoinBoost
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
    claimState === 'claimed' ? 'btn-claim--claimed' : '',
  ].filter(Boolean).join(' ')

  const claimLabel =
    claimState === 'claimed' ? '✓ ¡Reclamado!' :
    claimState === 'empty'   ? 'Nada pendiente' :
    energy <= 0              ? 'Sin energía'    :
    'Reclamar monedas'

  return (
    <div className="base-dashboard">

      {/* ── Events Banner ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--c-accent, #a78bfa)' }}>
          ✨ Eventos Activos
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Daily event card */}
          <div style={{
            flex: '1 1 140px',
            border: `2px solid ${dailyEvent.tagColor}`,
            borderRadius: '10px',
            padding: '0.6rem 0.75rem',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{dailyEvent.icon}</span>
              <div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: dailyEvent.tagColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>HOY</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>{dailyEvent.title}</p>
              </div>
            </div>
            <ul style={{ margin: '0.25rem 0 0', padding: '0 0 0 1rem', fontSize: '0.72rem', color: 'var(--c-dim, #aaa)', lineHeight: 1.5 }}>
              {getEventEffectLines(dailyEvent).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {/* Weekly event card */}
          <div style={{
            flex: '1 1 140px',
            border: `2px solid ${weeklyEvent.tagColor}`,
            borderRadius: '10px',
            padding: '0.6rem 0.75rem',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{weeklyEvent.icon}</span>
              <div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: weeklyEvent.tagColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>SEMANA</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>{weeklyEvent.title}</p>
              </div>
            </div>
            <ul style={{ margin: '0.25rem 0 0', padding: '0 0 0 1rem', fontSize: '0.72rem', color: 'var(--c-dim, #aaa)', lineHeight: 1.5 }}>
              {getEventEffectLines(weeklyEvent).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Daily event claim button */}
        {eventClaimState === 'claimed' ? (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--c-green, #4ade80)', fontWeight: 600 }}>
            ✓ ¡Bonus reclamado!
          </p>
        ) : canClaimEventBonus(player, today) ? (
          <button
            onClick={handleEventClaim}
            disabled={todayDone < 1}
            type="button"
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.45rem',
              borderRadius: '8px',
              border: 'none',
              background: todayDone >= 1 ? 'var(--c-accent, #7c3aed)' : 'var(--c-surface, #2a2a3a)',
              color: todayDone >= 1 ? '#fff' : 'var(--c-dim, #888)',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: todayDone >= 1 ? 'pointer' : 'not-allowed',
            }}
            title={todayDone < 1 ? 'Completa al menos 1 tarea para reclamar' : 'Reclamar bonus de evento (1 vez al día)'}
          >
            🎁 Reclamar bonus diario {todayDone < 1 ? '(necesitas 1 tarea)' : '(+20 monedas)'}
          </button>
        ) : null}
      </div>

      {/* ── Hero card ────────────────────────────────────────────── */}
      <div className="base-hero-card card">

        <div className="hero-top-row">
          <div className="hero-coins-block">
            <span className="hero-coin-icon">🪙</span>
            <div>
              <motion.span
                className="hero-coins"
                key={player.coins}
                initial={{ scale: 1.15, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              >
                {player.coins ?? 0}
              </motion.span>
              <span className="hero-coins-label">Monedas</span>
            </div>
          </div>

          <div className="hero-mini-row">
            <div className="hero-mini-chip">
              <span className="hero-mini-label">CPM</span>
              <span className="hero-mini-value">{cpmTotal.toFixed(1)}</span>
            </div>
            <div className="hero-mini-chip">
              <span className="hero-mini-label">Zona</span>
              <span className="hero-mini-value">{player.currentZone ?? 1}</span>
            </div>
            <div className="hero-mini-chip">
              <span className="hero-mini-label">Power</span>
              <span className="hero-mini-value">{powerScore ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Energy bar */}
        <div className="hero-energy-block">
          <div className="hero-energy-label-row">
            <span>⚡ Energía</span>
            <span>{Math.floor(energy)}/{effectiveEnergyCap}</span>
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

        {/* CTA Reclamar */}
        <button
          className={claimClass}
          onClick={handleClaim}
          disabled={energy <= 0 || !!claimState}
          type="button"
          aria-label="Reclamar monedas idle acumuladas"
        >
          {claimLabel}
        </button>

        {/* Earned breakdown */}
        <div className="earn-breakdown">
          <span className="earn-factor">Base {cpmBase}</span>
          <span style={{ color: 'var(--c-dimmer)' }}>×</span>
          <span className={`earn-factor ${teamMult > 1 ? 'earn-factor--highlight' : ''}`}>
            Equipo ×{teamMult.toFixed(2)}
          </span>
          {boostMult > 1 && (
            <>
              <span style={{ color: 'var(--c-dimmer)' }}>×</span>
              <span className="earn-factor earn-factor--highlight">
                Boost ×{boostMult}
              </span>
            </>
          )}
          {talentMult > 1 && (
            <>
              <span style={{ color: 'var(--c-dimmer)' }}>×</span>
              <span className="earn-factor">Talent ×{talentMult.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Status chips ─────────────────────────────────────────── */}
      <div className="base-status card">
        <p className="base-status-title">Estado</p>
        <div className="status-chips">

          {activeCoinBoost ? (
            <div className="status-chip status-chip--boost">
              <span className="status-chip-icon">🚀</span>
              <div className="status-chip-body">
                <span className="status-chip-label">Boost activo</span>
                <span className="status-chip-value">
                  {activeCoinBoostDef?.label ?? activeCoinBoost.id} — {boostRemainingMin}m
                </span>
              </div>
            </div>
          ) : (
            <div className="status-chip">
              <span className="status-chip-icon">💤</span>
              <div className="status-chip-body">
                <span className="status-chip-label">Boost</span>
                <span className="status-chip-value" style={{ color: 'var(--c-dim)' }}>Sin boost</span>
              </div>
            </div>
          )}

          <div className="status-chip">
            <span className="status-chip-icon">📍</span>
            <div className="status-chip-body">
              <span className="status-chip-label">Zona actual</span>
              <span className="status-chip-value">Zona {player.currentZone ?? 1}</span>
            </div>
          </div>

          <div className="status-chip">
            <span className="status-chip-icon">⚡</span>
            <div className="status-chip-body">
              <span className="status-chip-label">Power score</span>
              <span className="status-chip-value">{powerScore ?? 0}</span>
            </div>
          </div>

          {teamMult > 1 && (
            <div className="status-chip">
              <span className="status-chip-icon">👥</span>
              <div className="status-chip-body">
                <span className="status-chip-label">Mult. equipo</span>
                <span className="status-chip-value">×{teamMult.toFixed(2)}</span>
              </div>
            </div>
          )}

          {talentMult > 1 && (
            <div className="status-chip">
              <span className="status-chip-icon">🌟</span>
              <div className="status-chip-body">
                <span className="status-chip-label">Mult. talentos</span>
                <span className="status-chip-value">×{talentMult.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────── */}
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
              <span className="quick-action-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Daily loop ───────────────────────────────────────────── */}
      <div className="base-daily card">
        <div className="daily-loop-header">
          <span className="daily-loop-title">🎯 Objetivo del día</span>
          <span className={`daily-loop-count ${goalMet ? 'daily-loop-count--met' : ''}`}>
            {goalProgress}/{dailyGoal} {goalMet ? '✓' : ''}
          </span>
        </div>

        {/* Task chips */}
        <div className="daily-chips">
          {Array.from({ length: dailyGoal }, (_, i) => (
            <span
              key={i}
              className={`daily-chip ${i < todayDone ? 'daily-chip--done' : ''}`}
            >
              {i < todayDone ? '✓' : `${i + 1}`}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="progress-wrap">
          <motion.div
            className={`progress-fill ${goalMet ? 'progress-fill--done' : ''}`}
            animate={{ width: `${goalPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            style={{ minWidth: goalPct > 0 ? 4 : 0 }}
          />
        </div>

        {goalMet && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--c-green)', fontWeight: 600 }}
          >
            ¡Objetivo cumplido! 🎉
          </motion.p>
        )}
      </div>
    </div>
  )
}
