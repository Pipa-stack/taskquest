import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { canPrestige, computeEssenceGain } from '../domain/prestige.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * Prestige/Ascension panel.
 *
 * Displays current Essence, global bonus, power score, and the
 * "Ascender" button with a confirmation modal.
 *
 * A white flash + fade animation plays on successful prestige.
 *
 * Props:
 *   player      – player record from usePlayer()
 *   powerScore  – pre-computed integer power score
 *   currentZone – current zone id (player.currentZone)
 *   onNotify    – callback(message) for toast notifications
 */
export default function PrestigePanel({ player, powerScore, currentZone, onNotify }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [flashing, setFlashing] = useState(false)

  const essence = player.essence ?? 0
  const globalMultiplier = player.globalMultiplierCache ?? 1
  const prestigeCount = player.prestigeCount ?? 0
  const bonusPercent = Math.round((globalMultiplier - 1) * 100)
  const eligible = canPrestige(player, powerScore, currentZone)
  const essenceGain = computeEssenceGain(powerScore)

  const handleConfirm = async () => {
    setShowConfirm(false)
    setFlashing(true)
    setTimeout(() => setFlashing(false), 900)

    const ok = await playerRepository.prestige(powerScore, currentZone)
    if (ok) {
      if (onNotify) onNotify(`✨ ¡Ascendiste! +${essenceGain} Essence`)
    }
  }

  return (
    <div className="prestige-panel">
      {/* White flash overlay on prestige */}
      <AnimatePresence>
        {flashing && (
          <motion.div
            key="prestige-flash"
            className="prestige-flash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <h2 className="prestige-title">✨ Ascensión</h2>

      {/* Stats grid */}
      <div className="prestige-stats">
        <div className="prestige-stat-card">
          <span className="prestige-stat-label">Essence acumulada</span>
          <span className="prestige-stat-value prestige-essence">{essence} ✨</span>
        </div>

        <div className="prestige-stat-card">
          <span className="prestige-stat-label">Bonus global</span>
          <span className="prestige-stat-value prestige-bonus">
            +{bonusPercent}%
            <span className="prestige-multiplier-detail"> (×{globalMultiplier.toFixed(2)})</span>
          </span>
        </div>

        <div className="prestige-stat-card">
          <span className="prestige-stat-label">Power actual</span>
          <span className="prestige-stat-value prestige-power">⚡ {powerScore}</span>
        </div>

        <div className="prestige-stat-card">
          <span className="prestige-stat-label">Ascensiones</span>
          <span className="prestige-stat-value">{prestigeCount}</span>
        </div>
      </div>

      {/* Essence preview on next prestige */}
      {eligible && (
        <div className="prestige-preview">
          <span>Ganarás en esta ascensión: </span>
          <strong>+{essenceGain} ✨ Essence</strong>
          <span> → bonus global {Math.round(((1 + (essence + essenceGain) * 0.02) - 1) * 100)}%</span>
        </div>
      )}

      {/* Requirements info */}
      {!eligible && (
        <div className="prestige-requirements">
          <p className="prestige-req-title">Requisitos para ascender:</p>
          <ul className="prestige-req-list">
            <li className={currentZone >= 6 ? 'req-met' : 'req-unmet'}>
              {currentZone >= 6 ? '✓' : '✗'} Zona 6 desbloqueada (actual: {currentZone})
            </li>
            <li className={powerScore >= 250 ? 'req-met' : 'req-unmet'}>
              {powerScore >= 250 ? '✓' : '✗'} ⚡ Power ≥ 250 (actual: {powerScore})
            </li>
          </ul>
        </div>
      )}

      {/* Ascend button */}
      <button
        className={`prestige-btn${eligible ? ' prestige-btn-ready' : ' prestige-btn-locked'}`}
        onClick={() => eligible && setShowConfirm(true)}
        disabled={!eligible}
        type="button"
      >
        ✨ Ascender
      </button>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            key="prestige-modal-backdrop"
            className="prestige-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              className="prestige-modal"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="prestige-modal-title">✨ Confirmar Ascensión</h3>

              <div className="prestige-modal-warning">
                <p>Perderás:</p>
                <ul>
                  <li>Todas las monedas</li>
                  <li>Progreso de zonas (volverás a Zona 1)</li>
                  <li>Tasa de monedas por minuto (vuelta a 1)</li>
                </ul>
              </div>

              <div className="prestige-modal-gain">
                <p>Ganarás:</p>
                <ul>
                  <li><strong>+{essenceGain} ✨ Essence</strong></li>
                  <li>Multiplicador global permanente: ×{(1 + (essence + essenceGain) * 0.02).toFixed(2)}</li>
                  <li>Energía recargada al máximo</li>
                </ul>
              </div>

              <div className="prestige-modal-actions">
                <button
                  className="prestige-modal-cancel"
                  onClick={() => setShowConfirm(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="prestige-modal-confirm"
                  onClick={handleConfirm}
                  type="button"
                >
                  ✨ Confirmar Ascensión
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
