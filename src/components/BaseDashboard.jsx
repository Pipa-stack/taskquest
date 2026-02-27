import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveBoosts, applyBoostsToCaps } from '../domain/boosts.js'
import { computeIdleEarnings, calcTeamMultiplier } from '../domain/idle.js'
import { computeTalentBonuses } from '../domain/talents.js'
import { getZone } from '../domain/zones.js'
import { getDailyLoopStatus, isDailyLoopClaimed, DAILY_LOOP_REWARD } from '../domain/dailyLoop.js'
import { getZoneQuests } from '../domain/zoneQuests.js'
import { CHARACTERS } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'
import { todayKey } from '../domain/dateKey.js'
import db from '../db/db.js'

/**
 * BaseDashboard — the main hub screen shown first.
 *
 * Blocks:
 *  1. Reclamar idle coins (CTA grande)
 *  2. Estado: coins/min, energía, boost activo, zona, power
 *  3. Acciones rápidas: 5 botones
 *  4. Objetivos de hoy: daily goal + daily loop conditions + zone quests mini-preview
 *  5. Progreso: barra hacia próxima zona
 *
 * Banner "Daily loop completado" cuando allDone && !alreadyClaimed.
 */
export default function BaseDashboard({
  player,
  powerScore,
  onNotify,
  onNavigate,
}) {
  const today = todayKey()
  const nowMs = Date.now()

  // Live count of today's completed tasks
  const todayDone = useLiveQuery(
    () => db.tasks.where('[dueDate+status]').equals([today, 'done']).count(),
    [today]
  ) ?? 0

  // ── Derived idle values ──────────────────────────────────────────────────
  const activeBoosts = getActiveBoosts(player.boosts ?? [], nowMs)
  const talentBonuses = computeTalentBonuses(player.talents ?? {})
  const effectiveEnergyCap = applyBoostsToCaps(
    (player.energyCap ?? 100) + talentBonuses.energyCapBonus,
    activeBoosts,
  )
  const teamMultiplier = calcTeamMultiplier(
    player.activeTeam ?? [],
    {},
    CHARACTERS,
  )
  const effectiveCpm =
    (player.coinsPerMinuteBase ?? 1) *
    teamMultiplier *
    talentBonuses.idleCoinMult *
    (activeBoosts.reduce((max, b) => Math.max(max, b.coinMultiplier ?? 1), 1))

  const activeCoinBoost = activeBoosts.filter((b) => b.coinMultiplier).sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  // Accumulated coins estimate
  const accEarnings = computeIdleEarnings({
    now: nowMs,
    lastTickAt: player.lastIdleTickAt != null ? new Date(player.lastIdleTickAt).getTime() : null,
    energy: player.energy ?? 100,
    energyCap: effectiveEnergyCap,
    baseCpm: player.coinsPerMinuteBase ?? 1,
    multiplier: teamMultiplier * talentBonuses.idleCoinMult,
    activeBoosts,
  })
  const accumulatedCoins = accEarnings.coinsEarned
  const hasEnergy = (player.energy ?? 0) > 0

  // ── Daily loop ────────────────────────────────────────────────────────────
  const loopStatus = getDailyLoopStatus(player, todayDone, today)
  const alreadyClaimed = isDailyLoopClaimed(player, today)
  const showLoopBanner = loopStatus.allDone && !alreadyClaimed

  // ── Zone ──────────────────────────────────────────────────────────────────
  const currentZone = getZone(player.currentZone ?? 1)
  const nextZone = getZone((player.currentZone ?? 1) + 1) ?? null
  const isMaxZone = !nextZone
  const zoneProgress = isMaxZone ? 100 : Math.min(
    100,
    Math.round((powerScore / (nextZone?.requiredPower || 1)) * 100)
  )

  // Zone quests mini-preview (first 3 of current zone)
  const zoneQuests = (getZoneQuests ? getZoneQuests(player.currentZone ?? 1) : []).slice(0, 3)
  const claimedQuestIds = ((player.zoneProgress ?? {})[player.currentZone ?? 1]?.claimedRewards) ?? []

  // ── Countdown for active boost ─────────────────────────────────────────────
  const [boostCountdown, setBoostCountdown] = useState('')
  useEffect(() => {
    if (!activeCoinBoost) return
    const tick = () => {
      const remaining = Math.max(0, activeCoinBoost.expiresAt - Date.now())
      const mins = Math.floor(remaining / 60_000)
      const secs = Math.floor((remaining % 60_000) / 1_000)
      setBoostCountdown(`${mins}m ${secs}s`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [activeCoinBoost])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClaim = async () => {
    const { coinsEarned } = await playerRepository.tickIdle(Date.now(), teamMultiplier, true)
    if (onNotify) {
      if (coinsEarned > 0) onNotify(`+${coinsEarned} monedas reclamadas`)
      else onNotify('Sin monedas que reclamar (sin energía o muy pronto)')
    }
  }

  const handleClaimLoop = async () => {
    const reward = await playerRepository.claimDailyLoop(todayDone)
    if (reward && onNotify) {
      onNotify(`¡Loop diario completado! +${reward.coins} monedas, +${reward.essence} esencia`)
    }
  }

  // ── Daily goal bar ────────────────────────────────────────────────────────
  const dailyGoal = player.dailyGoal ?? 3
  const goalProgress = Math.min(todayDone, dailyGoal)
  const goalPct = dailyGoal > 0 ? Math.round((goalProgress / dailyGoal) * 100) : 0
  const goalMet = todayDone >= dailyGoal

  return (
    <div className="base-dashboard">

      {/* ── Daily loop banner ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLoopBanner && (
          <motion.div
            className="loop-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span>¡Loop diario completado! 🎉 +{DAILY_LOOP_REWARD.coins} monedas +{DAILY_LOOP_REWARD.essence} esencia</span>
            <button className="loop-banner-btn" onClick={handleClaimLoop}>
              Reclamar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 1. Reclamar ────────────────────────────────────────────────────── */}
      <div className="base-block base-block-claim">
        <div className="base-block-header">
          <span className="base-block-title">🪙 Monedas acumuladas</span>
          <span className="base-coins-amount">{accumulatedCoins}</span>
        </div>
        <button
          className="base-claim-btn"
          onClick={handleClaim}
          disabled={!hasEnergy}
        >
          {hasEnergy ? 'Reclamar monedas' : 'Sin energía'}
        </button>
      </div>

      {/* ── 2. Estado ──────────────────────────────────────────────────────── */}
      <div className="base-block base-block-status">
        <span className="base-block-title">📊 Estado</span>
        <div className="base-status-grid">
          <div className="base-stat">
            <span className="base-stat-label">Monedas/min</span>
            <span className="base-stat-value">{effectiveCpm.toFixed(2)}</span>
          </div>
          <div className="base-stat">
            <span className="base-stat-label">Energía</span>
            <span className="base-stat-value">{player.energy ?? 100}/{effectiveEnergyCap}</span>
          </div>
          <div className="base-stat">
            <span className="base-stat-label">Zona</span>
            <span className="base-stat-value">{currentZone?.emoji} {currentZone?.name}</span>
          </div>
          <div className="base-stat">
            <span className="base-stat-label">Power</span>
            <span className="base-stat-value">{powerScore}</span>
          </div>
          {activeCoinBoost && (
            <div className="base-stat base-stat-boost">
              <span className="base-stat-label">Boost x{activeCoinBoost.coinMultiplier}</span>
              <span className="base-stat-value base-boost-timer">{boostCountdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Acciones rápidas ────────────────────────────────────────────── */}
      <div className="base-block base-block-actions">
        <span className="base-block-title">⚡ Acciones rápidas</span>
        <div className="base-action-btns">
          {[
            { label: '🚀 Boosts', tab: 'Boosts' },
            { label: '🎰 Gacha', tab: 'Colección' },
            { label: '🗺️ Mapa', tab: 'Mapa' },
            { label: '✨ Talentos', tab: 'Talentos' },
            { label: '👥 Colección', tab: 'Colección' },
          ].map(({ label, tab }) => (
            <button
              key={label}
              className="base-action-btn"
              onClick={() => onNavigate?.(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Objetivos de hoy ───────────────────────────────────────────── */}
      <div className="base-block base-block-goals">
        <span className="base-block-title">🎯 Objetivos de hoy</span>

        {/* Daily goal bar */}
        <div className="base-goal-bar-wrap">
          <div className="base-goal-label">
            Tareas: {goalProgress}/{dailyGoal}
            {goalMet && <span className="base-goal-done"> ✓</span>}
          </div>
          <div className="base-goal-bar">
            <motion.div
              className="base-goal-bar-fill"
              animate={{ width: `${goalPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Daily loop conditions */}
        <div className="base-loop-chips">
          <span className={`base-loop-chip ${loopStatus.goalMet ? 'chip-done' : ''}`}>
            {loopStatus.goalMet ? '✓' : '○'} Meta diaria
          </span>
          <span className={`base-loop-chip ${loopStatus.idleClaimed ? 'chip-done' : ''}`}>
            {loopStatus.idleClaimed ? '✓' : '○'} Idle reclamado
          </span>
          <span className={`base-loop-chip ${loopStatus.gachaPulled ? 'chip-done' : ''}`}>
            {loopStatus.gachaPulled ? '✓' : '○'} Gacha hoy
          </span>
        </div>

        {/* Zone quests mini-preview */}
        {zoneQuests.length > 0 && (
          <div className="base-zone-quests">
            <span className="base-zone-quests-label">Misiones de zona</span>
            {zoneQuests.map((quest) => {
              const claimed = claimedQuestIds.includes(quest.id)
              return (
                <div key={quest.id} className={`base-quest-row ${claimed ? 'quest-claimed' : ''}`}>
                  <span className="base-quest-label">{quest.label}</span>
                  {claimed && <span className="base-quest-check">✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 5. Progreso ───────────────────────────────────────────────────── */}
      <div className="base-block base-block-progress">
        <span className="base-block-title">📈 Progreso</span>
        {isMaxZone ? (
          <div className="base-prestige-placeholder">
            <p>¡Zona máxima alcanzada!</p>
            <p className="base-prestige-hint">Prestigio próximamente...</p>
          </div>
        ) : (
          <>
            <div className="base-zone-progress-label">
              Hacia {nextZone.emoji} {nextZone.name} — {zoneProgress}%
              (Power: {powerScore}/{nextZone.requiredPower})
            </div>
            <div className="base-zone-progress-bar">
              <motion.div
                className="base-zone-progress-fill"
                animate={{ width: `${zoneProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
