import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Modal from '../ui/Modal.jsx'
import Badge from '../ui/Badge.jsx'

const RARITY_CONFIG = {
  common:    { label: 'Común',      badgeVariant: 'neutral', emoji: '⚪', color: '#94a3b8', glow: false },
  uncommon:  { label: 'Poco común', badgeVariant: 'green',   emoji: '🟢', color: '#4ade80', glow: false },
  rare:      { label: 'Raro',       badgeVariant: 'blue',    emoji: '🔵', color: '#60a5fa', glow: false },
  epic:      { label: 'Épico',      badgeVariant: 'purple',  emoji: '🟣', color: '#a78bfa', glow: true  },
  legendary: { label: 'Legendario', badgeVariant: 'gold',    emoji: '⭐', color: '#fbbf24', glow: true  },
}

function CardReveal({ result, delay, revealed, reduced }) {
  const cfg = RARITY_CONFIG[result.rarity] ?? RARITY_CONFIG.common
  const isLegendary = result.rarity === 'legendary'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, rotateY: reduced ? 0 : -90 }}
      animate={
        revealed
          ? { opacity: 1, scale: 1, rotateY: 0 }
          : { opacity: 0, scale: 0.75, rotateY: reduced ? 0 : -90 }
      }
      transition={{
        delay: reduced ? 0 : delay * 0.1,
        duration: reduced ? 0.01 : 0.32,
        ease: 'easeOut',
      }}
      style={{
        background: `rgba(${
          result.rarity === 'common'    ? '148,163,184' :
          result.rarity === 'uncommon'  ? '74,222,128'  :
          result.rarity === 'rare'      ? '96,165,250'  :
          result.rarity === 'epic'      ? '167,139,250' :
                                          '251,191,36'
        }, 0.08)`,
        border: `2px solid ${cfg.color}44`,
        borderRadius: '12px',
        padding: '1rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: cfg.glow ? `0 0 18px ${cfg.color}33` : undefined,
      }}
    >
      {/* Legendary shimmer */}
      {isLegendary && !reduced && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.06), transparent, rgba(251,191,36,0.04))',
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
        />
      )}
      <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{cfg.emoji}</span>
      <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
    </motion.div>
  )
}

/**
 * PackOpeningModal — animated card-reveal experience.
 *
 * Props:
 *  open     {boolean}        – modal visibility
 *  onClose  {Function}       – dismiss callback
 *  results  {Array<{id, rarity}>} – pull results
 *  pack     {object}         – pack definition (has .name)
 */
export default function PackOpeningModal({ open, onClose, results = [], pack }) {
  const [revealed, setRevealed] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    setRevealed(false)
    setShowSummary(false)

    if (reduced) {
      setRevealed(true)
      setShowSummary(true)
      return
    }

    const t1 = setTimeout(() => setRevealed(true), 380)
    const t2 = setTimeout(
      () => setShowSummary(true),
      380 + results.length * 110 + 350
    )
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [open, results.length, reduced])

  const summary = results.reduce((acc, r) => {
    acc[r.rarity] = (acc[r.rarity] ?? 0) + 1
    return acc
  }, {})

  const hasLegendary = results.some((r) => r.rarity === 'legendary')
  const isMulti      = results.length > 1

  return (
    <Modal open={open} onClose={onClose} title={pack?.name ?? 'Apertura de pack'} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Legendary celebration */}
        <AnimatePresence>
          {hasLegendary && revealed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.01 : 0.25 }}
              style={{
                textAlign: 'center',
                padding: '0.65rem 1rem',
                background: 'rgba(251,191,36,0.07)',
                borderRadius: '10px',
                border: '1px solid rgba(251,191,36,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>✨</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>
                ¡LEGENDARIO!
              </span>
              <span style={{ fontSize: '1.4rem' }}>✨</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMulti
              ? 'repeat(auto-fill, minmax(100px, 1fr))'
              : '200px',
            justifyContent: isMulti ? undefined : 'center',
            gap: '0.75rem',
          }}
        >
          {results.map((result, i) => (
            <CardReveal
              key={result.id}
              result={result}
              delay={i}
              revealed={revealed}
              reduced={reduced}
            />
          ))}
        </div>

        {/* Summary (multi-pull only) */}
        <AnimatePresence>
          {showSummary && isMulti && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0.01 : 0.22 }}
              style={{
                background: '#1a1a26',
                border: '1px solid #2a2a3e',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#5a5a7a',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Resumen
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {['legendary', 'epic', 'rare', 'uncommon', 'common'].map((rarity) => {
                  const count = summary[rarity]
                  if (!count) return null
                  const cfg = RARITY_CONFIG[rarity]
                  return (
                    <span key={rarity} style={{ fontSize: '0.82rem', color: cfg.color, fontWeight: 700 }}>
                      {count}× {cfg.label}
                    </span>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {!revealed && (
            <button
              onClick={() => { setRevealed(true); setShowSummary(true) }}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #2a2a3e',
                borderRadius: '8px',
                color: '#5a5a7a',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Saltar animación
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {revealed ? 'Cerrar' : 'Ver resultado'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
