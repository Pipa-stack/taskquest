import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XP_PER_LEVEL } from '../domain/gamification.js'
import { getCharacter } from '../domain/characters.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { playerRepository } from '../repositories/playerRepository.js'

const RARITY_COLORS = {
  common:    '#6b7280',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
}

/** Animated count-up from prevValue to value */
function CountUp({ value, duration = 800 }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef  = useRef(null)

  useEffect(() => {
    const from = prevRef.current
    const to   = value
    if (from === to) return

    const start = performance.now()
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <>{display}</>
}

/** Coin rain particles – purely CSS + framer-motion, no canvas */
function CoinRain({ trigger }) {
  const [coins, setCoins] = useState([])

  useEffect(() => {
    if (!trigger) return
    const particles = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100, // percent
      delay: Math.random() * 0.4,
    }))
    setCoins(particles)
    const timer = setTimeout(() => setCoins([]), 1800)
    return () => clearTimeout(timer)
  }, [trigger])

  return (
    <div className="coin-rain" aria-hidden="true">
      <AnimatePresence>
        {coins.map((c) => (
          <motion.span
            key={c.id}
            className="coin-particle"
            style={{ left: `${c.x}%` }}
            initial={{ opacity: 1, y: 0, scale: 0.6 }}
            animate={{ opacity: 0, y: 60, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, delay: c.delay, ease: 'easeIn' }}
          >
            🪙
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * FarmHUD – compact, premium sidebar widget.
 * Shows coins prominently, mini stats row (CPM / Energy / Boost),
 * glowing Reclamar CTA, level/XP, team chips, daily goal.
 */
export default function PlayerStats({
  xp, level, streak, xpToNext, combo, dailyGoal, syncStatus, activeTeam,
  coins, energy, energyCap, boosts, coinsPerMinuteBase,
  onNotify,
}) {
  const xpIntoLevel = XP_PER_LEVEL - xpToNext
  const pct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)

  const today = todayKey()

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
  const effectiveEnergyCap = applyBoostsToCaps(energyCap ?? 100, activeBoostList)
  const energyPct = effectiveEnergyCap > 0
    ? Math.round(((energy ?? 100) / effectiveEnergyCap) * 100)
    : 100

  const activeCoinBoost = activeBoostList
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  const effectiveCpm = (coinsPerMinuteBase ?? 1) * (activeCoinBoost?.coinMultiplier ?? 1)

  // Claim state
  const [claiming, setClaiming] = useState(false)
  const [rainTrigger, setRainTrigger] = useState(0)
  const [prevCoins, setPrevCoins] = useState(coins ?? 0)

  // Track coin value for count-up
  const coinValue = coins ?? 0

  const handleGoalChange = async (e) => {
    await playerRepository.setDailyGoal(Number(e.target.value))
  }

  const handleTickIdle = async () => {
    if (claiming) return
    setClaiming(true)
    try {
      const { coinsEarned } = await playerRepository.tickIdle(Date.now())
      if (coinsEarned > 0) {
        setPrevCoins(coins ?? 0)
        setRainTrigger((t) => t + 1)
        if (onNotify) onNotify(`+${coinsEarned} 🪙 reclamadas`)
      } else {
        if (onNotify) onNotify('Sin monedas que reclamar')
      }
    } finally {
      setClaiming(false)
    }
  }

  // Claimable if energy > 0 and lastIdleTickAt indicates time has passed
  // We approximate by checking energy > 0 (if energy is 0, there's nothing to claim)
  const coinsEarnable = (energy ?? 100) > 0

  return (
    <div className="player-stats">

      {/* Header row */}
      <div className="hud-header">
        <span className="hud-label">HUD</span>
        <span className="hud-sync">
          {syncStatus === 'pending' && <span title="Sincronización pendiente">⏳</span>}
          {syncStatus === 'error'   && <span title="Error de sincronización">⚠️</span>}
        </span>
      </div>

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

      {/* Level + XP bar */}
      <div className="hud-level-row">
        <div className="hud-level-block">
          <span className="hud-micro-label">Nivel</span>
          <motion.span
            className="hud-level-num"
            key={level}
            initial={{ scale: 1.4, color: '#a78bfa' }}
            animate={{ scale: 1, color: '#e2e2e7' }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            {level}
          </motion.span>
        </div>
        <div className="hud-xp-block">
          <div
            className="xp-bar-wrap"
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
          <span className="hud-xp-hint">{xpToNext} XP → nv {level + 1}</span>
        </div>
      </div>

      {/* Streak mini pill */}
      {streak > 0 && (
        <div className="hud-streak-pill">🔥 Racha {streak}</div>
      )}

      {/* ── Idle Farm section ── */}
      <div className="hud-farm">
        {/* Big coin display */}
        <div className="hud-coins-block">
          <span className="hud-coins-icon">🪙</span>
          <span className="hud-coins-value">
            <CountUp value={coinValue} />
          </span>
          <CoinRain trigger={rainTrigger} />
        </div>

        {/* Mini stats: CPM · Energy · Boost */}
        <div className="hud-mini-stats">
          <div className="hud-mini-stat">
            <span className="hud-mini-label">CPM</span>
            <span className="hud-mini-value">
              {effectiveCpm.toFixed(1)}
              {activeCoinBoost && <span className="hud-boost-badge"> ×{activeCoinBoost.coinMultiplier}</span>}
            </span>
          </div>
          <div className="hud-mini-stat">
            <span className="hud-mini-label">Energía</span>
            <span className="hud-mini-value">{Math.floor(energy ?? 100)}/{effectiveEnergyCap}</span>
          </div>
          {activeCoinBoost && (() => {
            const boostDef = getBoost(activeCoinBoost.id)
            const remainingMin = Math.max(0, Math.ceil((activeCoinBoost.expiresAt - nowMs) / 60_000))
            return (
              <div className="hud-mini-stat">
                <span className="hud-mini-label">Boost</span>
                <span className="hud-mini-value hud-boost-timer">🚀 {remainingMin}m</span>
              </div>
            )
          })()}
        </div>

        {/* Energy progress */}
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

        {/* Reclamar CTA */}
        <button
          className={`hud-claim-btn ${coinsEarnable ? 'hud-claim-btn--active' : ''}`}
          onClick={handleTickIdle}
          disabled={!coinsEarnable || claiming}
          type="button"
          title="Reclamar monedas acumuladas"
        >
          {claiming ? 'Reclamando…' : coinsEarnable ? '✦ Reclamar' : 'Nada que reclamar'}
        </button>
      </div>

      {/* Team chips */}
      <div className="hud-team-section">
        <span className="hud-micro-label">Tu equipo aumenta el farmeo</span>
        <div className="hud-team-chips">
          {[0, 1, 2].map((slot) => {
            const id   = activeTeam?.[slot]
            const char = id ? getCharacter(id) : null
            return (
              <div
                key={slot}
                className={`hud-chip ${char ? 'hud-chip--filled' : 'hud-chip--empty'}`}
                style={char ? { borderColor: RARITY_COLORS[char.rarity] ?? '#4a4a6a' } : undefined}
                title={char ? `${char.name} (${char.rarity})` : 'Slot vacío'}
              >
                {char ? (
                  <>
                    <span className="hud-chip-emoji">{char.emoji}</span>
                    <span className="hud-chip-stage" style={{ color: RARITY_COLORS[char.rarity] }}>{char.stage}</span>
                  </>
                ) : (
                  <span className="hud-chip-plus">+</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily goal */}
      <div className="daily-goal">
        <div className="daily-goal-header">
          <span className="daily-goal-label">
            Objetivo: {goalProgress}/{dailyGoal}
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
