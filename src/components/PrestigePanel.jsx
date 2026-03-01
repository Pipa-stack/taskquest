import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Modal from '../ui/Modal.jsx'

/** What the player loses on Prestige */
const PRESTIGE_LOSES = [
  { icon: '🪙', label: 'Monedas',       desc: 'Se reinician a 0'     },
  { icon: '⚡',  label: 'Energía',       desc: 'Vuelve al máximo base' },
  { icon: '🗺️', label: 'Zonas',         desc: 'Regresa a Zona 1'     },
  { icon: '👥', label: 'Equipo activo', desc: 'Se limpia el equipo'  },
  { icon: '🧬', label: 'XP',            desc: 'Se reinicia a 0'      },
]

/** What the player gains on Prestige */
const PRESTIGE_GAINS = [
  { icon: '✨', label: 'Esencia Prestige',         desc: '+20 esencia especial'          },
  { icon: '📈', label: 'Multiplicador permanente', desc: '+5 % coins/min global'          },
  { icon: '💎', label: 'Distinción',               desc: 'Emblema Prestige en tu perfil'  },
]

/** Minimum level required to prestige */
const MIN_LEVEL = 20

function ListItem({ icon, label, desc, tint }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.45rem 0.8rem',
        background: tint === 'red'
          ? 'rgba(248,113,113,0.05)'
          : 'rgba(74,222,128,0.05)',
        border: `1px solid ${tint === 'red' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)'}`,
        borderRadius: '8px',
        fontSize: '0.82rem',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 600, color: '#e2e2e7', flex: 1 }}>{label}</span>
      <span style={{ color: '#5a5a7a', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{desc}</span>
    </div>
  )
}

/**
 * PrestigePanel — premium confirmation modal.
 *
 * Shows a "pierdes / ganas" list and a strong CTA.
 * Prestige logic is a placeholder until the domain layer supports it.
 *
 * Props:
 *  open     {boolean}   – modal visibility
 *  onClose  {Function}  – dismiss callback
 *  level    {number}    – current player level
 *  onNotify {Function}  – toast callback
 */
export default function PrestigePanel({ open, onClose, level = 1, onNotify }) {
  const [confirming, setConfirming] = useState(false)
  const reduced = useReducedMotion()

  const canPrestige = level >= MIN_LEVEL

  const handleConfirm = () => {
    setConfirming(true)
    setTimeout(() => {
      setConfirming(false)
      onClose?.()
      onNotify?.('⭐ Prestige próximamente — ¡mantente al tanto!')
    }, reduced ? 0 : 1200)
  }

  return (
    <Modal open={open} onClose={onClose} title="⭐ Prestige" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Level gate warning */}
        {!canPrestige && (
          <div
            style={{
              background: 'rgba(248,113,113,0.07)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              color: '#f87171',
              fontWeight: 600,
            }}
          >
            Necesitas Nivel {MIN_LEVEL} para hacer Prestige.
            Nivel actual: <strong>{level}</strong>
          </div>
        )}

        {/* Description */}
        <p style={{ fontSize: '0.88rem', color: '#8a8ab0', lineHeight: 1.65, margin: 0 }}>
          El Prestige reinicia tu progreso a cambio de bonificaciones permanentes que
          hacen cada partida futura más poderosa.
        </p>

        {/* Loses */}
        <div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#f87171',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            ⬇ Pierdes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {PRESTIGE_LOSES.map((item) => (
              <ListItem key={item.label} tint="red" {...item} />
            ))}
          </div>
        </div>

        {/* Gains */}
        <div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#4ade80',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            ⬆ Ganas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {PRESTIGE_GAINS.map((item) => (
              <ListItem key={item.label} tint="green" {...item} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #2a2a3e' }} />

        {/* CTA */}
        <AnimatePresence mode="wait">
          {confirming ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center',
                color: '#a78bfa',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '0.75rem',
              }}
            >
              ✨ Procesando Prestige…
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', gap: '0.75rem' }}
            >
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: 'transparent',
                  border: '1px solid #2a2a3e',
                  borderRadius: '10px',
                  color: '#8a8ab0',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirm}
                disabled={!canPrestige}
                style={{
                  flex: 2,
                  padding: '0.7rem',
                  background: canPrestige
                    ? 'linear-gradient(135deg, #a78bfa, #60a5fa)'
                    : '#1e1e2e',
                  border: 'none',
                  borderRadius: '10px',
                  color: canPrestige ? '#fff' : '#5a5a7a',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  cursor: canPrestige ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  letterSpacing: '0.03em',
                  boxShadow: canPrestige
                    ? '0 2px 12px rgba(167,139,250,0.35)'
                    : 'none',
                  transition: 'opacity 0.15s',
                  opacity: canPrestige ? 1 : 0.45,
                }}
              >
                ⭐ Confirmar Prestige
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
