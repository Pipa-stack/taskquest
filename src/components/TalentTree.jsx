import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  computeTalentBonuses,
  computeTalentMilestones,
  costForNextPoint,
  TALENT_MAX,
  MILESTONE_THRESHOLDS,
} from '../domain/talents.js'
import { playerRepository } from '../repositories/playerRepository.js'

/** Branch metadata */
const BRANCH_META = {
  idle: {
    label: 'Economía',
    emoji: '💰',
    color: '#f59e0b',
    colorDim: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
    description: 'Aumenta monedas pasivas, cap de energía y su regeneración',
    milestoneLabel: '+1% global extra',
  },
  gacha: {
    label: 'Suerte',
    emoji: '🎲',
    color: '#a78bfa',
    colorDim: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
    description: 'Mejora tasa de raros y reduce el umbral de piedad',
    milestoneLabel: '-1 piedad',
  },
  power: {
    label: 'Energía',
    emoji: '⚡',
    color: '#22d3ee',
    colorDim: 'rgba(34,211,238,0.15)',
    borderColor: 'rgba(34,211,238,0.4)',
    description: 'Amplifica poder, duración de boosts y descuento de evolución',
    milestoneLabel: '+10 cap extra',
  },
}

/** Returns preview lines for a branch at current level and next level */
function getBranchPreview(branch, talents, coinsPerMinuteBase, energyCap) {
  const next = { ...talents, [branch]: (talents[branch] ?? 0) + 1 }
  const cur = computeTalentBonuses(talents)
  const nxt = computeTalentBonuses(next)
  const base = coinsPerMinuteBase ?? 1
  const cap  = energyCap ?? 100

  if (branch === 'idle') {
    return [
      {
        label: 'Monedas/min',
        cur: `${(base * cur.idleCoinMult).toFixed(1)}`,
        nxt: `${(base * nxt.idleCoinMult).toFixed(1)}`,
        better: true,
      },
      {
        label: 'Cap energía',
        cur: `${cap + cur.energyCapBonus}`,
        nxt: `${cap + nxt.energyCapBonus}`,
        better: true,
      },
      {
        label: 'Regen/min',
        cur: `${cur.energyRegenPerMin.toFixed(1)}`,
        nxt: `${nxt.energyRegenPerMin.toFixed(1)}`,
        better: true,
      },
    ]
  }
  if (branch === 'gacha') {
    return [
      {
        label: 'Tasa rara',
        cur: `+${Math.round(cur.gachaRareBonus * 100)}%`,
        nxt: `+${Math.round(nxt.gachaRareBonus * 100)}%`,
        better: true,
      },
      {
        label: 'Piedad -',
        cur: `${cur.pityReduction}`,
        nxt: `${nxt.pityReduction}`,
        better: true,
      },
      {
        label: 'Milestone',
        cur: nxt.gachaMilestones > cur.gachaMilestones ? '⭐ Nuevo hito' : `${cur.gachaMilestones}/3`,
        nxt: nxt.gachaMilestones > cur.gachaMilestones ? '⭐ Nuevo hito' : `${nxt.gachaMilestones}/3`,
        better: nxt.gachaMilestones > cur.gachaMilestones,
      },
    ]
  }
  // power
  return [
    {
      label: 'Poder mult.',
      cur: `×${cur.powerMult.toFixed(2)}`,
      nxt: `×${nxt.powerMult.toFixed(2)}`,
      better: true,
    },
    {
      label: 'Dur. boost',
      cur: `×${cur.boostDurationMult.toFixed(2)}`,
      nxt: `×${nxt.boostDurationMult.toFixed(2)}`,
      better: true,
    },
    {
      label: 'Desc. evolución',
      cur: `-${Math.round(cur.evolveDiscount * 100)}%`,
      nxt: `-${Math.round(nxt.evolveDiscount * 100)}%`,
      better: nxt.evolveDiscount > cur.evolveDiscount,
    },
  ]
}

/** Milestone pip row */
function MilestonePips({ milestones }) {
  return (
    <div className="talent-milestones">
      {milestones.map(({ threshold, reached }) => (
        <motion.div
          key={threshold}
          className={`talent-milestone-pip ${reached ? 'talent-milestone-pip--reached' : ''}`}
          animate={reached ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          title={`Hito ${threshold} pts`}
        >
          <span className="talent-milestone-num">{threshold}</span>
          {reached && <span className="talent-milestone-star">★</span>}
        </motion.div>
      ))}
    </div>
  )
}

/** Individual talent branch card */
function TalentCard({ branch, talents, essence, coinsPerMinuteBase, energyCap, onUpgrade }) {
  const [glowing, setGlowing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const meta = BRANCH_META[branch]
  const currentPoints = talents[branch] ?? 0
  const bonuses = computeTalentBonuses(talents)
  const milestones = computeTalentMilestones(talents)[branch]
  const nextCost = costForNextPoint(currentPoints)
  const canUpgrade = currentPoints < TALENT_MAX && essence >= nextCost
  const isMaxed = currentPoints >= TALENT_MAX
  const progressPct = (currentPoints / TALENT_MAX) * 100

  // Milestone marker positions on the bar (%)
  const milestonePositions = MILESTONE_THRESHOLDS.map((t) => ({
    pct: (t / TALENT_MAX) * 100,
    reached: currentPoints >= t,
  }))

  const handleUpgrade = async () => {
    if (!canUpgrade) return
    const ok = await onUpgrade(branch)
    if (ok) {
      setGlowing(true)
      setTimeout(() => setGlowing(false), 800)
    }
  }

  const preview = !isMaxed
    ? getBranchPreview(branch, talents, coinsPerMinuteBase, energyCap)
    : null

  return (
    <motion.div
      className={`talent-card2 ${glowing ? 'talent-card2--glow' : ''}`}
      style={{ '--branch-color': meta.color, '--branch-color-dim': meta.colorDim, '--branch-border': meta.borderColor }}
      animate={glowing ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="talent-card2__header">
        <motion.span
          className="talent-card2__emoji"
          animate={glowing ? { rotate: [0, -15, 15, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          {meta.emoji}
        </motion.span>
        <div className="talent-card2__title-group">
          <h3 className="talent-card2__name">{meta.label}</h3>
          <p className="talent-card2__desc">{meta.description}</p>
        </div>
        <div className="talent-card2__level-badge">
          <span className="talent-card2__pts">{currentPoints}</span>
          <span className="talent-card2__pts-max">/{TALENT_MAX}</span>
        </div>
      </div>

      {/* Progress bar with milestone markers */}
      <div className="talent-card2__bar-wrap">
        <motion.div
          className="talent-card2__bar-fill"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {milestonePositions.map(({ pct, reached }, i) => (
          <div
            key={i}
            className={`talent-card2__bar-marker ${reached ? 'talent-card2__bar-marker--reached' : ''}`}
            style={{ left: `${pct}%` }}
            title={`Hito ${MILESTONE_THRESHOLDS[i]}`}
          />
        ))}
      </div>

      {/* Milestone pips */}
      <MilestonePips milestones={milestones} />

      {/* Current bonuses summary */}
      <div className="talent-card2__bonuses">
        {branch === 'idle' && (
          <>
            <span className="talent-card2__bonus-chip">💰 ×{bonuses.idleCoinMult.toFixed(2)}</span>
            <span className="talent-card2__bonus-chip">⚡ +{bonuses.energyCapBonus} cap</span>
            {bonuses.energyRegenPerMin > 0 && (
              <span className="talent-card2__bonus-chip">🔋 +{bonuses.energyRegenPerMin.toFixed(1)}/min</span>
            )}
          </>
        )}
        {branch === 'gacha' && (
          <>
            <span className="talent-card2__bonus-chip">🎲 +{Math.round(bonuses.gachaRareBonus * 100)}% rare</span>
            {bonuses.pityReduction > 0 && (
              <span className="talent-card2__bonus-chip">🍀 piedad -{bonuses.pityReduction}</span>
            )}
          </>
        )}
        {branch === 'power' && (
          <>
            <span className="talent-card2__bonus-chip">⚔️ ×{bonuses.powerMult.toFixed(2)}</span>
            <span className="talent-card2__bonus-chip">🚀 boost ×{bonuses.boostDurationMult.toFixed(2)}</span>
            {bonuses.evolveDiscount > 0 && (
              <span className="talent-card2__bonus-chip">🔧 -{Math.round(bonuses.evolveDiscount * 100)}% evolución</span>
            )}
          </>
        )}
      </div>

      {/* Preview / Upgrade footer */}
      {!isMaxed ? (
        <div className="talent-card2__footer">
          {/* Preview toggle */}
          <button
            className="talent-card2__preview-btn"
            onClick={() => setShowPreview((v) => !v)}
            type="button"
          >
            {showPreview ? '▲ Ocultar' : '▼ Ver mejora'}
          </button>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                className="talent-card2__preview"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                {preview.map(({ label, cur, nxt, better }) => (
                  <div key={label} className="talent-card2__preview-row">
                    <span className="talent-card2__preview-label">{label}</span>
                    <span className="talent-card2__preview-cur">{cur}</span>
                    <span className="talent-card2__preview-arrow">→</span>
                    <span className={`talent-card2__preview-nxt ${better ? 'talent-card2__preview-nxt--better' : ''}`}>
                      {nxt}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="talent-card2__upgrade-row">
            <span className="talent-card2__cost">✨ {nextCost} esencia</span>
            <motion.button
              className={`talent-card2__btn ${canUpgrade ? 'talent-card2__btn--active' : 'talent-card2__btn--disabled'}`}
              disabled={!canUpgrade}
              onClick={handleUpgrade}
              whileTap={canUpgrade ? { scale: 0.92 } : {}}
              whileHover={canUpgrade ? { scale: 1.04 } : {}}
            >
              Mejorar
            </motion.button>
          </div>
        </div>
      ) : (
        <motion.div
          className="talent-card2__maxed"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 250, damping: 18 }}
        >
          ✨ ¡Nivel máximo!
        </motion.div>
      )}
    </motion.div>
  )
}

/** Active bonuses panel */
function ActiveBonusesPanel({ bonuses }) {
  const items = [
    { label: 'Monedas/min mult.',  value: `×${bonuses.idleCoinMult.toFixed(2)}`,       show: bonuses.idleCoinMult > 1 },
    { label: 'Cap energía +',      value: `+${bonuses.energyCapBonus}`,                 show: bonuses.energyCapBonus > 0 },
    { label: 'Regen energía',      value: `+${bonuses.energyRegenPerMin.toFixed(1)}/min`, show: bonuses.energyRegenPerMin > 0 },
    { label: 'Tasa rara gacha',    value: `+${Math.round(bonuses.gachaRareBonus * 100)}%`, show: bonuses.gachaRareBonus > 0 },
    { label: 'Piedad reducida',    value: `-${bonuses.pityReduction}`,                  show: bonuses.pityReduction > 0 },
    { label: 'Poder mult.',        value: `×${bonuses.powerMult.toFixed(2)}`,           show: bonuses.powerMult > 1 },
    { label: 'Duración boosts',    value: `×${bonuses.boostDurationMult.toFixed(2)}`,   show: bonuses.boostDurationMult > 1 },
    { label: 'Desc. evolución',    value: `-${Math.round(bonuses.evolveDiscount * 100)}%`, show: bonuses.evolveDiscount > 0 },
  ].filter((i) => i.show)

  if (items.length === 0) {
    return (
      <div className="talent-active-panel">
        <h4 className="talent-active-panel__title">Bonuses activos</h4>
        <p className="talent-active-panel__empty">Sin bonuses activos aún. ¡Sube talentos!</p>
      </div>
    )
  }

  return (
    <div className="talent-active-panel">
      <h4 className="talent-active-panel__title">✨ Bonuses activos</h4>
      <ul className="talent-active-panel__list">
        {items.map(({ label, value }) => (
          <motion.li
            key={label}
            className="talent-active-panel__item"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="talent-active-panel__label">{label}</span>
            <span className="talent-active-panel__value">{value}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

/**
 * TalentTree component — redesigned with milestones, preview, and animations.
 *
 * @param {{ essence: number, talents: object, coinsPerMinuteBase: number, energyCap: number, onNotify: function }} props
 */
export default function TalentTree({ essence, talents, coinsPerMinuteBase, energyCap, onNotify }) {
  const talentsNorm = talents ?? { idle: 0, gacha: 0, power: 0 }
  const bonuses = computeTalentBonuses(talentsNorm)
  const totalMilestones = bonuses.idleMilestones + bonuses.gachaMilestones + bonuses.powerMilestones

  const handleUpgrade = async (branch) => {
    const prevBonuses = computeTalentBonuses(talentsNorm)
    const ok = await playerRepository.spendEssenceOnTalent(branch)
    if (ok) {
      const meta = BRANCH_META[branch]
      // Toast for standard upgrade
      onNotify?.(`${meta.emoji} Talento mejorado: ${meta.label} +1`)

      // Check if a milestone was just crossed
      const newPoints = (talentsNorm[branch] ?? 0) + 1
      if (MILESTONE_THRESHOLDS.includes(newPoints)) {
        setTimeout(() => {
          onNotify?.(`⭐ Hito desbloqueado: ${meta.label} nivel ${newPoints}! ${meta.milestoneLabel}`)
        }, 350)
      }
    }
    return ok
  }

  return (
    <div className="talent-tree2">
      {/* Header */}
      <div className="talent-tree2__header">
        <div className="talent-tree2__title-row">
          <h2 className="talent-tree2__title">Árbol de Talentos</h2>
          {totalMilestones > 0 && (
            <motion.span
              className="talent-tree2__milestone-badge"
              key={totalMilestones}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              ⭐ {totalMilestones} hito{totalMilestones !== 1 ? 's' : ''}
            </motion.span>
          )}
        </div>
        <div className="talent-tree2__essence-row">
          <motion.span
            className="talent-tree2__essence"
            key={essence}
            initial={{ scale: 1.25, color: '#f59e0b' }}
            animate={{ scale: 1, color: '#e2e2e7' }}
            transition={{ duration: 0.4 }}
          >
            ✨ {essence} esencia disponible
          </motion.span>
        </div>
      </div>

      {/* Layout: cards + bonus panel */}
      <div className="talent-tree2__layout">
        {/* Branch cards */}
        <div className="talent-tree2__cards">
          {['idle', 'gacha', 'power'].map((branch) => (
            <TalentCard
              key={branch}
              branch={branch}
              talents={talentsNorm}
              essence={essence}
              coinsPerMinuteBase={coinsPerMinuteBase}
              energyCap={energyCap}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>

        {/* Active bonuses panel */}
        <ActiveBonusesPanel bonuses={bonuses} />
      </div>

      {essence === 0 && (
        <p className="talent-tree2__hint">
          Consigue Esencia completando tareas y subiendo de nivel.
        </p>
      )}
    </div>
  )
}
