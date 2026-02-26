import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getActiveBoosts, applyBoostsToCaps, getBoost } from '../domain/boosts.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * FarmHUD — main idle farming panel for the Base tab.
 *
 * Shows: coins (animated count-up), coins/min with boost multiplier,
 * energy bar (with pulse when full), active boost countdown,
 * and a big "Reclamar" CTA with coin burst effect on claim.
 *
 * Props:
 *   coins             {number}  – current coin balance
 *   energy            {number}  – current energy
 *   energyCap         {number}  – base energy cap
 *   boosts            {Array}   – active boosts array from player
 *   coinsPerMinuteBase{number}  – base coins per minute
 *   onNotify          {Function}– callback(message) for toast notifications
 */
export default function FarmHUD({ coins, energy, energyCap, boosts, coinsPerMinuteBase, onNotify }) {
  const [claiming, setClaiming] = useState(false)
  const [burst, setBurst] = useState(null) // { amount, id }
  const [displayCoins, setDisplayCoins] = useState(coins ?? 0)
  const prevCoinsRef = useRef(coins ?? 0)
  const animFrameRef = useRef(null)

  // Tick nowMs every second for live boost countdown
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Count-up animation when coins increase
  useEffect(() => {
    const start = prevCoinsRef.current
    const end = coins ?? 0
    prevCoinsRef.current = end

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    if (end <= start) {
      setDisplayCoins(end)
      return
    }

    const diff = end - start
    const duration = Math.min(700, Math.max(200, diff * 8))
    const startTime = performance.now()

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCoins(Math.round(start + diff * eased))
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [coins])

  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
  const effectiveEnergyCap = applyBoostsToCaps(energyCap ?? 100, activeBoostList)
  const currentEnergy = energy ?? 100
  const energyPct = effectiveEnergyCap > 0
    ? Math.min(100, Math.round((currentEnergy / effectiveEnergyCap) * 100))
    : 100
  const isFull = energyPct >= 100

  const activeCoinBoost = activeBoostList
    .filter((b) => b.coinMultiplier)
    .sort((a, b) => b.coinMultiplier - a.coinMultiplier)[0] ?? null

  const effectiveCpm = (coinsPerMinuteBase ?? 1) * (activeCoinBoost?.coinMultiplier ?? 1)
  const canClaim = currentEnergy > 0.01

  // Active boost countdown info
  let boostInfo = null
  if (activeCoinBoost) {
    const boostDef = getBoost(activeCoinBoost.id)
    const remainingMs = activeCoinBoost.expiresAt - nowMs
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000))
    boostInfo = { label: boostDef?.label ?? activeCoinBoost.id, minutes: remainingMin }
  }

  const handleClaim = async () => {
    if (claiming) return
    setClaiming(true)
    try {
      const { coinsEarned } = await playerRepository.tickIdle(Date.now())
      if (coinsEarned > 0) {
        setBurst({ amount: coinsEarned, id: Date.now() })
        onNotify?.(`+${coinsEarned} 🪙 reclamadas`)
      } else {
        onNotify?.('Nada que reclamar todavía')
      }
    } catch (e) {
      console.warn('tickIdle error', e)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="farm-hud">
      {/* ── Coin display ── */}
      <div className="farm-coins-wrap">
        <span className="farm-coins-icon">🪙</span>
        <span className="farm-coins-value">
          {displayCoins.toLocaleString('es-ES')}
        </span>
        <span className="farm-coins-label">monedas</span>
      </div>

      {/* ── Coins/min row ── */}
      <div className="farm-cpm-row">
        <span className="farm-cpm-label">Monedas/min</span>
        <span className="farm-cpm-value">
          {effectiveCpm % 1 === 0 ? effectiveCpm : effectiveCpm.toFixed(1)}
          {activeCoinBoost && (
            <span className="farm-boost-badge"> ×{activeCoinBoost.coinMultiplier}</span>
          )}
        </span>
      </div>

      {/* ── Energy bar ── */}
      <div className="farm-energy">
        <div className="farm-energy-header">
          <span className="farm-energy-label">⚡ Energía</span>
          <span className="farm-energy-value">
            {Math.floor(currentEnergy)} / {effectiveEnergyCap}
          </span>
        </div>
        <div
          className="farm-energy-bar-outer"
          role="progressbar"
          aria-valuenow={energyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Energía: ${Math.floor(currentEnergy)} de ${effectiveEnergyCap}`}
        >
          <motion.div
            className={`farm-energy-bar-fill${isFull ? ' farm-energy-full' : ''}`}
            animate={{ width: `${energyPct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
        {isFull && <p className="farm-energy-full-hint">¡Energía llena! Reclama para no perder.</p>}
      </div>

      {/* ── Active boost info ── */}
      {boostInfo && (
        <div className="farm-boost-active">
          🚀 {boostInfo.label} — {boostInfo.minutes}m restantes
        </div>
      )}

      {/* ── Claim CTA ── */}
      <div className="farm-claim-wrapper">
        <AnimatePresence>
          {burst && (
            <motion.div
              key={burst.id}
              className="farm-coin-burst"
              initial={{ y: 0, opacity: 1, scale: 1 }}
              animate={{ y: -80, opacity: 0, scale: 1.5 }}
              exit={{}}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              onAnimationComplete={() => setBurst(null)}
            >
              +{burst.amount} 🪙
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          className={`farm-claim-btn${canClaim && !claiming ? ' farm-claim-btn--active' : ' farm-claim-btn--idle'}`}
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          whileHover={canClaim && !claiming ? { scale: 1.02 } : {}}
          whileTap={canClaim && !claiming ? { scale: 0.97 } : {}}
          type="button"
          aria-label="Reclamar monedas acumuladas"
        >
          {claiming
            ? '⏳ Reclamando…'
            : canClaim
              ? '⚡ Reclamar recompensa'
              : '💤 Sin energía'}
        </motion.button>
      </div>
    </div>
  )
}
