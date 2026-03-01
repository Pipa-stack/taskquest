import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { computeTalentBonuses, costForNextPoint, TALENT_MAX } from '../domain/talents.js'
import { playerRepository } from '../repositories/playerRepository.js'
import { StatRow, Badge } from '../ui/index.js'

/** Branch visual configuration */
const BRANCH_META = {
  idle: {
    label:       'Idle',
    emoji:       '⏰',
    description: 'Mejora la producción pasiva de monedas',
    color:       '#fbbf24',
    dimColor:    'rgba(251,191,36,0.12)',
    border:      'rgba(251,191,36,0.3)',
    badgeVariant:'gold',
    milestones:  [3, 6, 10],
    getBonusText(bonuses, points) {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round((bonuses.idleCoinMult - 1) * 100)}% coins/min`]
      if (bonuses.energyCapBonus > 0) parts.push(`+${bonuses.energyCapBonus} cap energía`)
      return parts.join(' · ')
    },
  },
  gacha: {
    label:       'Gacha',
    emoji:       '🎲',
    description: 'Mejora las probabilidades de personajes raros',
    color:       '#a78bfa',
    dimColor:    'rgba(167,139,250,0.12)',
    border:      'rgba(167,139,250,0.3)',
    badgeVariant:'purple',
    milestones:  [3, 6, 10],
    getBonusText(bonuses, points) {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round(bonuses.gachaRareBonus * 100)}% tasa rare`]
      if (bonuses.pityReduction > 0) parts.push(`piedad −${bonuses.pityReduction}`)
      return parts.join(' · ')
    },
  },
  power: {
    label:       'Poder',
    emoji:       '⚡',
    description: 'Amplifica el poder de combate y reduce costes de evolución',
    color:       '#22d3ee',
    dimColor:    'rgba(34,211,238,0.1)',
    border:      'rgba(34,211,238,0.3)',
    badgeVariant:'teal',
    milestones:  [3, 6, 10],
    getBonusText(bonuses, points) {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round((bonuses.powerMult - 1) * 100)}% poder`]
      if (bonuses.evolveDiscount > 0) parts.push(`−${Math.round(bonuses.evolveDiscount * 100)}% evolución`)
      return parts.join(' · ')
    },
  },
}

/** Milestone dot row for a talent branch */
function MilestoneRow({ currentPoints, milestones, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      {milestones.map((ms) => {
        const reached = currentPoints >= ms
        return (
          <div
            key={ms}
            title={`Hito: ${ms} pts`}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: reached ? color : '#1e1e2e',
              border: `2px solid ${reached ? color : '#2a2a3e'}`,
              fontSize: '0.55rem',
              fontWeight: 800,
              color: reached ? '#111' : '#3a3a5a',
              transition: 'background 0.3s, border-color 0.3s',
              flexShrink: 0,
            }}
          >
            {ms}
          </div>
        )
      })}
      <span style={{ fontSize: '0.68rem', color: '#5a5a7a', marginLeft: '0.25rem' }}>
        hitos
      </span>
    </div>
  )
}

/** Individual talent branch card */
function TalentCard({ branch, talents, essence, onUpgrade, reduced }) {
  const [glowing, setGlowing] = useState(false)
  const meta          = BRANCH_META[branch]
  const currentPoints = talents[branch] ?? 0
  const bonuses       = computeTalentBonuses(talents)
  const nextCost      = costForNextPoint(currentPoints)
  const canUpgrade    = currentPoints < TALENT_MAX && essence >= nextCost
  const progressPct   = (currentPoints / TALENT_MAX) * 100

  const handleUpgrade = async () => {
    if (!canUpgrade) return
    const ok = await onUpgrade(branch)
    if (ok && !reduced) {
      setGlowing(true)
      setTimeout(() => setGlowing(false), 700)
    }
  }

  return (
    <motion.div
      animate={glowing ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: reduced ? 0.01 : 0.45, ease: 'easeOut' }}
      style={{
        background: glowing ? meta.dimColor : '#16161f',
        border: `1px solid ${glowing ? meta.border : '#2a2a3e'}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: '14px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        transition: reduced ? 'none' : 'background 0.3s, border-color 0.3s',
        boxShadow: glowing
          ? `0 0 20px ${meta.dimColor}, 0 4px 24px rgba(0,0,0,0.4)`
          : '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{meta.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#e2e2e7', margin: 0 }}>
              {meta.label}
            </h3>
            <Badge variant={meta.badgeVariant}>{currentPoints}/{TALENT_MAX}</Badge>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#8a8ab0', margin: '0.2rem 0 0' }}>
            {meta.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '7px',
          background: '#1e1e2e',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{ height: '100%', borderRadius: '999px', background: meta.color, minWidth: '2px' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: reduced ? 0.01 : 0.4 }}
        />
      </div>

      {/* Milestones */}
      <MilestoneRow
        currentPoints={currentPoints}
        milestones={meta.milestones}
        color={meta.color}
      />

      {/* Current bonuses */}
      <p style={{ fontSize: '0.78rem', color: meta.color, fontWeight: 600, margin: 0 }}>
        {meta.getBonusText(bonuses, currentPoints)}
      </p>

      {/* Footer: cost + button OR maxed */}
      {currentPoints < TALENT_MAX ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#8a8ab0' }}>
            ✨ {nextCost} esencia
          </span>
          <motion.button
            onClick={handleUpgrade}
            disabled={!canUpgrade}
            whileTap={canUpgrade && !reduced ? { scale: 0.93 } : {}}
            style={{
              padding: '0.4rem 1.1rem',
              background: canUpgrade
                ? `linear-gradient(135deg, ${meta.color}dd, ${meta.color}99)`
                : '#1e1e2e',
              border: 'none',
              borderRadius: '8px',
              color: canUpgrade ? '#0f0f13' : '#5a5a7a',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: canUpgrade ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              opacity: canUpgrade ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            Mejorar
          </motion.button>
        </div>
      ) : (
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: meta.color,
            margin: 0,
          }}
        >
          ¡Nivel máximo!
        </p>
      )}
    </motion.div>
  )
}

/**
 * TalentTree — redesigned 3-branch talent tree with:
 *  - themed branch colors
 *  - milestone dots
 *  - active bonuses summary panel
 *
 * Props:
 *  essence  {number} – available essence
 *  talents  {object} – {idle, gacha, power}
 *  onNotify {Function}
 */
export default function TalentTree({ essence, talents, onNotify }) {
  const reduced     = useReducedMotion()
  const talentsNorm = talents ?? { idle: 0, gacha: 0, power: 0 }
  const bonuses     = computeTalentBonuses(talentsNorm)

  const handleUpgrade = async (branch) => {
    const ok = await playerRepository.spendEssenceOnTalent(branch)
    if (ok) onNotify?.(`Talento mejorado: ${BRANCH_META[branch].label} +1`)
    return ok
  }

  const hasAnyBonus = talentsNorm.idle > 0 || talentsNorm.gacha > 0 || talentsNorm.power > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#e2e2e7', margin: 0 }}>
            🌟 Árbol de Talentos
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#5a5a7a', margin: '0.2rem 0 0' }}>
            Mejoras permanentes para tu aventura
          </p>
        </div>

        {/* Essence display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: '999px',
            flexShrink: 0,
          }}
        >
          <span>✨</span>
          <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#a78bfa' }}>{essence}</span>
          <span style={{ fontSize: '0.72rem', color: '#8a8ab0' }}>esencia</span>
        </div>
      </div>

      {/* ── Active bonuses panel ───────────────────────────── */}
      {hasAnyBonus && (
        <div
          style={{
            background: '#1a1a26',
            border: '1px solid #2a2a3e',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#5a5a7a',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            Bonificaciones activas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {talentsNorm.idle > 0 && (
              <StatRow
                icon="⏰"
                label="Coins/min"
                value={`+${Math.round((bonuses.idleCoinMult - 1) * 100)}%`}
                valueColor="#fbbf24"
                hint={bonuses.energyCapBonus > 0 ? `+${bonuses.energyCapBonus} cap energía` : undefined}
              />
            )}
            {talentsNorm.gacha > 0 && (
              <StatRow
                icon="🎲"
                label="Tasa Raro+"
                value={`+${Math.round(bonuses.gachaRareBonus * 100)}%`}
                valueColor="#a78bfa"
                hint={bonuses.pityReduction > 0 ? `piedad −${bonuses.pityReduction}` : undefined}
              />
            )}
            {talentsNorm.power > 0 && (
              <StatRow
                icon="⚡"
                label="Poder de combate"
                value={`+${Math.round((bonuses.powerMult - 1) * 100)}%`}
                valueColor="#22d3ee"
                hint={bonuses.evolveDiscount > 0 ? `−${Math.round(bonuses.evolveDiscount * 100)}% evolución` : undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Branch cards ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {['idle', 'gacha', 'power'].map((branch) => (
          <TalentCard
            key={branch}
            branch={branch}
            talents={talentsNorm}
            essence={essence}
            onUpgrade={handleUpgrade}
            reduced={reduced}
          />
        ))}
      </div>

      {/* Zero-essence hint */}
      {essence === 0 && !hasAnyBonus && (
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.82rem',
            color: '#5a5a7a',
            padding: '1rem',
          }}
        >
          Consigue Esencia completando tareas y subiendo de nivel.
        </p>
      )}
    </div>
  )
}
