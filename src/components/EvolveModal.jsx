import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STAGE_LABELS = { I: 'Stage I', II: 'Stage II', III: 'Stage III' }
const STAGE_ORDER  = ['I', 'II', 'III']

function nextStage(current) {
  const idx = STAGE_ORDER.indexOf(current)
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null
}

/**
 * EvolveModal — confirm + animate character evolution.
 *
 * Props:
 *   character   – character object { id, name, emoji, stage, rarity }
 *   cost        – coin cost (already discount-applied)
 *   coins       – player's current coins
 *   onConfirm   – async () => boolean; performs the actual evolution
 *   onClose     – () => void
 */
export default function EvolveModal({ character, cost, coins, onConfirm, onClose }) {
  const [phase, setPhase] = useState('confirm') // 'confirm' | 'animating' | 'done'
  const [busy,  setBusy]  = useState(false)

  if (!character) return null

  const targetStage = nextStage(character.stage)
  if (!targetStage) return null

  const canAfford = coins >= cost

  const handleConfirm = async () => {
    if (busy || !canAfford) return
    setBusy(true)
    setPhase('animating')

    const ok = await onConfirm()

    if (ok) {
      // Small delay so animation plays out
      setTimeout(() => {
        setPhase('done')
        setBusy(false)
      }, 600)
    } else {
      setPhase('confirm')
      setBusy(false)
    }
  }

  return (
    <div className="evolve-overlay" role="dialog" aria-modal="true" aria-label="Evolucionar personaje">
      {/* Backdrop */}
      <div className="evolve-backdrop" onClick={!busy ? onClose : undefined} />

      <motion.div
        className="evolve-panel card"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22 }}
      >
        {/* Flash overlay during animation */}
        <AnimatePresence>
          {phase === 'animating' && (
            <motion.div
              className="evolve-flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        <h2 className="evolve-title">
          {phase === 'done' ? '¡Evolución completada!' : `¿Evolucionar a ${STAGE_LABELS[targetStage]}?`}
        </h2>

        {/* Character display */}
        <motion.div
          className="evolve-char-display"
          animate={
            phase === 'animating'
              ? { scale: [1, 1.1, 1], transition: { duration: 0.6 } }
              : {}
          }
        >
          <span className="evolve-char-emoji">{character.emoji}</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={phase === 'done' ? targetStage : character.stage}
              className="evolve-stage-badge"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
            >
              {phase === 'done' ? STAGE_LABELS[targetStage] : STAGE_LABELS[character.stage]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {phase !== 'done' && (
          <>
            <p className="evolve-cost">
              Coste: <strong>🪙 {cost}</strong>
            </p>

            <ul className="evolve-benefits">
              <li>✦ Más poder de combate</li>
              <li>✦ Mayor multiplicador idle</li>
            </ul>

            {!canAfford && (
              <p className="evolve-warning">Monedas insuficientes ({coins} / {cost})</p>
            )}
          </>
        )}

        {phase === 'done' && (
          <p className="evolve-done-msg">
            {character.name} ha evolucionado a <strong>{STAGE_LABELS[targetStage]}</strong>. ¡Sigue adelante!
          </p>
        )}

        <div className="evolve-actions">
          {phase !== 'done' ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={!canAfford || busy}
              >
                {busy ? 'Evolucionando…' : 'Confirmar'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>
              ¡Genial!
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
