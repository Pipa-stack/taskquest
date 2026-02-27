import { useState } from 'react'
import { motion } from 'framer-motion'
import { computeTalentBonuses, costForNextPoint, TALENT_MAX } from '../domain/talents.js'
import { playerRepository } from '../repositories/playerRepository.js'

/** Metadata for each talent branch: labels and bonus description builders. */
const BRANCH_META = {
  idle: {
    label: 'Idle',
    emoji: '⏰',
    description: 'Mejora la producción pasiva de monedas',
    getBonusText: (bonuses, points) => {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round((bonuses.idleCoinMult - 1) * 100)}% coins/min`]
      if (bonuses.energyCapBonus > 0) parts.push(`+${bonuses.energyCapBonus} cap energía`)
      return parts.join(' · ')
    },
  },
  gacha: {
    label: 'Gacha',
    emoji: '🎲',
    description: 'Mejora las probabilidades de personajes raros',
    getBonusText: (bonuses, points) => {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round(bonuses.gachaRareBonus * 100)}% tasa rare`]
      if (bonuses.pityReduction > 0) parts.push(`piedad -${bonuses.pityReduction}`)
      return parts.join(' · ')
    },
  },
  power: {
    label: 'Poder',
    emoji: '⚡',
    description: 'Amplifica el poder de combate y reduce costes de evolución',
    getBonusText: (bonuses, points) => {
      if (points === 0) return 'Sin bonificaciones aún'
      const parts = [`+${Math.round((bonuses.powerMult - 1) * 100)}% poder`]
      if (bonuses.evolveDiscount > 0) parts.push(`-${Math.round(bonuses.evolveDiscount * 100)}% evolución`)
      return parts.join(' · ')
    },
  },
}

/** Individual talent branch card with upgrade button and animation. */
function TalentCard({ branch, talents, essence, onUpgrade }) {
  const [glowing, setGlowing] = useState(false)

  const meta = BRANCH_META[branch]
  const currentPoints = talents[branch] ?? 0
  const bonuses = computeTalentBonuses(talents)
  const nextCost = costForNextPoint(currentPoints)
  const canUpgrade = currentPoints < TALENT_MAX && essence >= nextCost
  const progressPct = (currentPoints / TALENT_MAX) * 100

  const handleUpgrade = async () => {
    if (!canUpgrade) return
    const ok = await onUpgrade(branch)
    if (ok) {
      setGlowing(true)
      setTimeout(() => setGlowing(false), 700)
    }
  }

  return (
    <motion.div
      className={`talent-card${glowing ? ' talent-card--glow' : ''}`}
      animate={glowing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="talent-card__header">
        <span className="talent-card__emoji">{meta.emoji}</span>
        <div className="talent-card__title-wrap">
          <h3 className="talent-card__name">{meta.label}</h3>
          <p className="talent-card__desc">{meta.description}</p>
        </div>
        <span className="talent-card__level-badge">{currentPoints}/{TALENT_MAX}</span>
      </div>

      {/* Progress bar */}
      <div className="talent-card__progress-track">
        <motion.div
          className="talent-card__progress-fill"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Current bonuses */}
      <p className="talent-card__bonuses">
        {meta.getBonusText(bonuses, currentPoints)}
      </p>

      {/* Footer: cost + button OR maxed label */}
      {currentPoints < TALENT_MAX ? (
        <div className="talent-card__footer">
          <span className="talent-card__cost">✨ {nextCost} esencia</span>
          <motion.button
            className="talent-card__btn"
            disabled={!canUpgrade}
            onClick={handleUpgrade}
            whileTap={canUpgrade ? { scale: 0.93 } : {}}
          >
            Mejorar
          </motion.button>
        </div>
      ) : (
        <p className="talent-card__maxed">¡Nivel máximo!</p>
      )}
    </motion.div>
  )
}

/**
 * TalentTree component — displays the 3-branch talent tree and handles upgrades.
 *
 * @param {{ essence: number, talents: object, onNotify: function }} props
 */
export default function TalentTree({ essence, talents, onNotify }) {
  const talentsNorm = talents ?? { idle: 0, gacha: 0, power: 0 }

  const handleUpgrade = async (branch) => {
    const ok = await playerRepository.spendEssenceOnTalent(branch)
    if (ok) {
      const branchLabel = BRANCH_META[branch].label
      onNotify?.(`Talento mejorado: ${branchLabel} +1`)
    }
    return ok
  }

  return (
    <div className="talent-tree">
      {/* Header with essence display */}
      <div className="talent-tree__header">
        <h2 className="talent-tree__title">Árbol de Talentos</h2>
        <div className="talent-tree__essence">
          <span className="talent-tree__essence-icon">✨</span>
          <span className="talent-tree__essence-value">{essence}</span>
          <span className="talent-tree__essence-label">esencia</span>
        </div>
      </div>

      {/* Three branch cards */}
      <div className="talent-tree__cards">
        {['idle', 'gacha', 'power'].map((branch) => (
          <TalentCard
            key={branch}
            branch={branch}
            talents={talentsNorm}
            essence={essence}
            onUpgrade={handleUpgrade}
          />
        ))}
      </div>

      {essence === 0 && (
        <p className="talent-tree__hint">
          Consigue Esencia completando tareas y subiendo de nivel.
        </p>
      )}
    </div>
  )
}
