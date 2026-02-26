import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCharacter } from '../domain/characters.js'

const RARITY_COLORS = {
  common:    '#6b7280',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
}

const RARITY_LABELS = {
  common:    'Común',
  uncommon:  'Poco común',
  rare:      'Raro',
  epic:      'Épico',
  legendary: 'Legendario',
}

/** Delay reveal of cards one by one */
const REVEAL_DELAY_MS = 420

/**
 * PackOpeningModal – animates reveal of gacha pull results.
 *
 * Props:
 *   pulls   – array of pull result objects { characterId, rarity, isNew, dustGained }
 *   onClose – callback when player closes the modal
 */
export default function PackOpeningModal({ pulls, onClose }) {
  const [revealedCount, setRevealedCount] = useState(0)
  const allRevealed = revealedCount >= pulls.length

  // Reveal cards one by one
  useEffect(() => {
    if (revealedCount >= pulls.length) return
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [revealedCount, pulls.length])

  // Escape key closes
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && allRevealed) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [allRevealed, onClose])

  const hasLegendary = pulls.some((p) => p.rarity === 'legendary')

  return (
    <AnimatePresence>
      <motion.div
        className="pack-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={allRevealed ? onClose : undefined}
      >
        {/* Legendary flash overlay */}
        {hasLegendary && (
          <motion.div
            className="pack-legendary-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />
        )}

        <motion.div
          className="pack-modal"
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pack-modal-title">
            {allRevealed ? '✨ Resultados' : '🎁 Abriendo…'}
          </div>

          {/* Cards grid */}
          <div className={`pack-cards-grid ${pulls.length === 1 ? 'pack-cards-grid--single' : ''}`}>
            <AnimatePresence>
              {pulls.slice(0, revealedCount).map((pull, i) => {
                const char = getCharacter(pull.characterId)
                const color = RARITY_COLORS[pull.rarity] ?? '#6b7280'
                const isLegendary = pull.rarity === 'legendary'

                return (
                  <motion.div
                    key={`${pull.characterId}-${i}`}
                    className={`pack-card ${isLegendary ? 'pack-card--legendary' : ''}`}
                    style={{ '--rarity-color': color, borderColor: color }}
                    initial={{ rotateY: 90, opacity: 0, scale: 0.6 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  >
                    {isLegendary && (
                      <motion.div
                        className="pack-card-glow"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                        style={{ boxShadow: `0 0 30px ${color}` }}
                      />
                    )}

                    <div className="pack-card-emoji">{char?.emoji ?? '❓'}</div>
                    <div className="pack-card-name">{char?.name ?? pull.characterId}</div>
                    <div className="pack-card-rarity" style={{ color }}>
                      {RARITY_LABELS[pull.rarity] ?? pull.rarity}
                    </div>

                    {pull.isNew ? (
                      <div className="pack-card-tag pack-card-tag--new">¡Nuevo!</div>
                    ) : (
                      <div className="pack-card-tag pack-card-tag--dup">
                        Duplicado → +{pull.dustGained} 💨
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Summary when all revealed */}
          {allRevealed && (
            <motion.div
              className="pack-summary"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="pack-summary-stats">
                {(() => {
                  const newCount  = pulls.filter((p) => p.isNew).length
                  const dustTotal = pulls.reduce((s, p) => s + p.dustGained, 0)
                  return (
                    <>
                      {newCount > 0 && (
                        <span className="pack-summary-item pack-summary-item--new">
                          {newCount} nuevo{newCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {dustTotal > 0 && (
                        <span className="pack-summary-item pack-summary-item--dust">
                          +{dustTotal} 💨 polvo
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
              <button className="pack-close-btn" onClick={onClose}>
                Continuar
              </button>
            </motion.div>
          )}

          {/* Skip hint */}
          {!allRevealed && (
            <button
              className="pack-skip-btn"
              onClick={() => setRevealedCount(pulls.length)}
            >
              Saltar →
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
