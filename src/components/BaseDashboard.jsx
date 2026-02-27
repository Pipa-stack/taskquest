import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import { getZone, ZONE_CATALOG } from '../domain/zones.js'
import { getZoneQuests, computeQuestProgress } from '../domain/zoneQuests.js'
import { getDailyLoopStatus, hasDailyLoopClaimed, DAILY_LOOP_REWARD } from '../domain/dailyLoop.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * BaseDashboard — main idle-game home screen.
 *
 * Displayed as the first tab. Shows a summary of all core idle-loop metrics
 * so the player can see their status at a glance and take the key daily actions.
 *
 * Props:
 *   player      {object}   – full player record from usePlayer()
 *   powerScore  {number}   – pre-computed power score
 *   onNotify    {Function} – toast notification callback(message)
 *   onNavigate  {Function} – tab navigation callback(tabName)
 */
export default function BaseDashboard({ player, powerScore, onNotify, onNavigate }) {
  const today = todayKey()

  // Live count of today's completed tasks
  const todayDone = useLiveQuery(
    () => db.tasks.where('[dueDate+status]').equals([today, 'done']).count(),
    [today]
  ) ?? 0

  // Idle derived values
  const nowMs = Date.now()
  const activeBoostList = getActiveBoosts(player.boosts ?? [], nowMs)
  const effectiveEnergyCap = applyBoostsToCaps(player.energyCap ?? 100, activeBoostList)
  const activeCoinBoost = activeBoostList
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  // Accumulation estimate: coins earned since last tick
  const lastTickAt = player.lastIdleTickAt ? new Date(player.lastIdleTickAt).getTime() : null
  const elapsedMs = lastTickAt ? Math.max(0, nowMs - lastTickAt) : 0
  const elapsedMin = Math.min(elapsedMs / 60_000, 180)
  const effectiveCpm = (player.coinsPerMinuteBase ?? 1) * (activeCoinBoost?.coinMultiplier ?? 1)
  const minutesUsable = Math.min(elapsedMin, player.energy ?? 0)
  const accumulatedCoins = Math.floor(minutesUsable * effectiveCpm)
  const isClaimable = accumulatedCoins > 0

  // Zone info
  const currentZone = getZone(player.currentZone ?? 1)
  const nextZone    = getZone((player.currentZone ?? 1) + 1)
  const maxZone     = ZONE_CATALOG[ZONE_CATALOG.length - 1]
  const isMaxZone   = (player.currentZone ?? 1) >= maxZone.id

  // Zone progress bar (toward next zone power requirement)
  const powerToNextZone = nextZone ? nextZone.requiredPower : 0
  const zonePct = nextZone
    ? Math.min(100, Math.round((powerScore / powerToNextZone) * 100))
    : 100

  // Daily goal
  const dailyGoal = player.dailyGoal ?? 3
  const goalMet   = todayDone >= dailyGoal
  const goalPct   = Math.min(100, Math.round((todayDone / dailyGoal) * 100))

  // Zone quests for current zone
  const zoneQuests = getZoneQuests(player.currentZone ?? 1).slice(0, 3)
  const claimedQuestIds = ((player.zoneProgress ?? {})[player.currentZone ?? 1]?.claimedRewards) ?? []

  // Daily loop status
  const loopStatus = getDailyLoopStatus({
    todayDone,
    dailyGoal,
    lastIdleClaimDate: player.lastIdleClaimDate ?? null,
    lastGachaPullDate: player.lastGachaPullDate ?? null,
    today,
  })
  const alreadyClaimed = hasDailyLoopClaimed(player, today)

  // Boost countdown (live timer every second)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!activeCoinBoost) return
    const id = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(id)
  }, [activeCoinBoost])

  const boostRemainingMin = activeCoinBoost
    ? Math.max(0, Math.ceil((activeCoinBoost.expiresAt - Date.now()) / 60_000))
    : null

  // --- Handlers ---

  const handleClaim = async () => {
    const { coinsEarned } = await playerRepository.tickIdle(Date.now(), 1, true)
    if (coinsEarned > 0) {
      onNotify?.(`+${coinsEarned} 🪙 reclamadas`)
    } else {
      onNotify?.('Sin monedas que reclamar (sin energía o demasiado pronto)')
    }
  }

  const handleClaimDailyLoop = async () => {
    if (alreadyClaimed) return
    const ok = await playerRepository.claimDailyLoop(today, todayDone)
    if (ok) {
      onNotify?.(`🎉 Daily loop completado! +${DAILY_LOOP_REWARD.coins} 🪙 +${DAILY_LOOP_REWARD.essence} ✨`)
    }
  }

  return (
    <div className="base-dashboard">

      {/* ── Daily loop banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {loopStatus.allDone && !alreadyClaimed && (
          <motion.div
            className="daily-loop-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <span className="daily-loop-icon">🏆</span>
            <span className="daily-loop-text">
              <strong>Daily loop completado</strong> — +{DAILY_LOOP_REWARD.coins} 🪙 +{DAILY_LOOP_REWARD.essence} ✨
            </span>
            <button
              className="daily-loop-claim-btn"
              onClick={handleClaimDailyLoop}
              type="button"
            >
              Reclamar
            </button>
          </motion.div>
        )}
        {alreadyClaimed && (
          <motion.div
            className="daily-loop-banner daily-loop-banner--done"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <span className="daily-loop-icon">✅</span>
            <span className="daily-loop-text">Daily loop reclamado hoy</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Block 1: Reclamar (main CTA) ─────────────────────────────── */}
      <section className="base-block base-block-claim">
        <div className="base-accumulation">
          <span className="base-acc-label">Acumulado</span>
          <motion.span
            className="base-acc-value"
            key={accumulatedCoins}
            animate={{ scale: isClaimable ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 0.4 }}
          >
            {accumulatedCoins} 🪙
          </motion.span>
        </div>
        <button
          className={`base-claim-btn ${isClaimable ? 'base-claim-btn--active' : 'base-claim-btn--idle'}`}
          onClick={handleClaim}
          type="button"
          disabled={!isClaimable}
        >
          {isClaimable ? '💰 Reclamar' : '⏳ Acumulando…'}
        </button>
        <p className="base-acc-hint">
          {isClaimable
            ? `${Math.floor(minutesUsable)}m de idle sin reclamar`
            : 'Sin energía o reclamado hace un momento'}
        </p>
      </section>

      {/* ── Block 2: Estado ──────────────────────────────────────────── */}
      <section className="base-block base-block-estado">
        <h3 className="base-block-title">Estado</h3>
        <div className="base-estado-grid">
          <div className="base-stat-row">
            <span className="base-stat-label">🪙/min efectivo</span>
            <span className="base-stat-value">
              {effectiveCpm.toFixed(1)}
              {activeCoinBoost && <span className="boost-badge-sm"> ×{activeCoinBoost.coinMultiplier}</span>}
            </span>
          </div>
          <div className="base-stat-row">
            <span className="base-stat-label">⚡ Energía</span>
            <span className="base-stat-value">{Math.floor(player.energy ?? 100)}/{effectiveEnergyCap}</span>
          </div>
          {activeCoinBoost && (() => {
            const boostDef = getBoost(activeCoinBoost.id)
            return (
              <div className="base-stat-row">
                <span className="base-stat-label">🚀 Boost</span>
                <span className="base-stat-value">
                  {boostDef?.label ?? activeCoinBoost.id} — {boostRemainingMin}m
                </span>
              </div>
            )
          })()}
          <div className="base-stat-row">
            <span className="base-stat-label">📍 Zona</span>
            <span className="base-stat-value">
              {currentZone?.emoji} {currentZone?.name ?? '?'}
            </span>
          </div>
          <div className="base-stat-row">
            <span className="base-stat-label">⚡ Power</span>
            <span className="base-stat-value">{powerScore ?? 0}</span>
          </div>
        </div>
      </section>

      {/* ── Block 3: Acciones rápidas ─────────────────────────────────── */}
      <section className="base-block base-block-actions">
        <h3 className="base-block-title">Acciones rápidas</h3>
        <div className="base-actions-grid">
          {[
            { label: '🚀 Boosts',    tab: 'Boosts'   },
            { label: '🎰 Gacha',     tab: 'Gacha'    },
            { label: '🗺️ Mapa',      tab: 'Mapa'     },
            { label: '🌟 Talentos',  tab: 'Talentos' },
            { label: '🎭 Colección', tab: 'Colección'},
          ].map(({ label, tab }) => (
            <button
              key={tab}
              className="base-action-btn"
              onClick={() => onNavigate?.(tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Block 4: Objetivos de hoy ─────────────────────────────────── */}
      <section className="base-block base-block-objectives">
        <h3 className="base-block-title">Objetivos de hoy</h3>

        {/* Daily goal */}
        <div className="base-objective">
          <div className="base-obj-header">
            <span className="base-obj-label">
              📋 Tareas del día: {todayDone}/{dailyGoal}
              {goalMet && <span className="base-obj-check"> ✓</span>}
            </span>
          </div>
          <div className="base-obj-bar-wrap" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className={`base-obj-bar ${goalMet ? 'base-obj-bar--done' : ''}`}
              animate={{ width: `${goalPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
        </div>

        {/* Daily loop conditions */}
        <div className="base-loop-conditions">
          <span className={`base-loop-cond ${loopStatus.goalMet ? 'cond-met' : ''}`}>
            {loopStatus.goalMet ? '✅' : '⬜'} Meta diaria
          </span>
          <span className={`base-loop-cond ${loopStatus.idleMet ? 'cond-met' : ''}`}>
            {loopStatus.idleMet ? '✅' : '⬜'} Claim idle
          </span>
          <span className={`base-loop-cond ${loopStatus.gachaMet ? 'cond-met' : ''}`}>
            {loopStatus.gachaMet ? '✅' : '⬜'} Pull gacha
          </span>
        </div>

        {/* Zone quests mini progress */}
        {zoneQuests.length > 0 && (
          <div className="base-quests">
            <p className="base-quests-subtitle">Misiones de zona:</p>
            {zoneQuests.map((quest) => {
              const isClaimed = claimedQuestIds.includes(quest.id)
              const progress = computeQuestProgress(quest, {
                player,
                tasksCompleted: todayDone,
              })
              const pct = Math.round((progress.current / progress.target) * 100)
              return (
                <div key={quest.id} className={`base-quest-item ${isClaimed ? 'quest-claimed' : ''}`}>
                  <span className="base-quest-label">
                    {isClaimed ? '✅' : progress.completed ? '🔓' : '⬜'} {quest.label}
                  </span>
                  <div className="base-quest-bar-wrap">
                    <div
                      className="base-quest-bar"
                      style={{ width: `${isClaimed ? 100 : pct}%` }}
                    />
                  </div>
                  <span className="base-quest-count">{isClaimed ? quest.target : progress.current}/{quest.target}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Block 5: Progreso ─────────────────────────────────────────── */}
      <section className="base-block base-block-progress">
        <h3 className="base-block-title">Progreso</h3>

        {/* Next zone progress */}
        {!isMaxZone && nextZone ? (
          <div className="base-progress-item">
            <div className="base-prog-header">
              <span className="base-prog-label">
                Hacia {nextZone.emoji} {nextZone.name}
              </span>
              <span className="base-prog-value">{powerScore}/{nextZone.requiredPower} power</span>
            </div>
            <div className="base-prog-bar-wrap" role="progressbar" aria-valuenow={zonePct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className="base-prog-bar"
                animate={{ width: `${zonePct}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 20 }}
              />
            </div>
          </div>
        ) : (
          <div className="base-progress-item">
            <span className="base-prog-label base-prog-max">
              ⭐ {currentZone?.name} — Zona máxima alcanzada
            </span>
          </div>
        )}

        {/* Prestige placeholder */}
        {isMaxZone && (
          <div className="base-prestige-hint">
            🔄 Prestige — próximamente
          </div>
        )}
      </section>

    </div>
  )
}
