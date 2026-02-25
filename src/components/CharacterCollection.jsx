import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHARACTER_CATALOG } from '../domain/characters.js'
import { getStage, canEvolve, evolveCost } from '../domain/evolution.js'
import { playerRepository } from '../repositories/playerRepository.js'

const RARITIES = ['all', 'common', 'rare', 'epic', 'legendary']

const RARITY_LABELS = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

const STAGE_LABELS = { 1: 'Stage 1', 2: 'Stage 2', 3: 'Stage 3' }

/**
 * Brief full-screen overlay shown when a character evolves.
 * Auto-dismisses after ~1 second.
 */
function EvoOverlay({ char, toStage, onDone }) {
  return (
    <motion.div
      className="evo-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={onDone}
      aria-live="assertive"
      aria-atomic="true"
    >
      <motion.div
        className="evo-overlay-content"
        initial={{ scale: 0.6, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 1.15, y: -20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      >
        <span className="evo-glow">{char.emoji}</span>
        <span className="evo-label">EVOLUCIÓN</span>
        <span className="evo-name">{char.name}</span>
        <span className="evo-stage-arrow">
          Stage {toStage - 1} → <strong>Stage {toStage}</strong>
        </span>
        <span className="evo-sparkles">✨</span>
      </motion.div>
    </motion.div>
  )
}

/**
 * Character collection view.
 * Shows all characters — unlocked ones revealed with stage info, locked ones as "???".
 * Unlocked characters can be evolved to Stage 2 / Stage 3 by spending coins.
 */
export default function CharacterCollection({ unlockedCharacters, characterStages, coins, onNotify }) {
  const [filter, setFilter] = useState('all')
  const [evoChar, setEvoChar] = useState(null) // { char, toStage } when overlay is active

  const unlockedSet = new Set(unlockedCharacters)
  const total = CHARACTER_CATALOG.length
  const ownedCount = CHARACTER_CATALOG.filter((c) => unlockedSet.has(c.id)).length

  const visible = filter === 'all'
    ? CHARACTER_CATALOG
    : CHARACTER_CATALOG.filter((c) => c.rarity === filter)

  // Build a fake player-like object so evolution domain functions work
  const playerProxy = { characterStages: characterStages ?? {} }

  const handleEvolve = useCallback(async (char) => {
    const stage = getStage(char.id, playerProxy)
    const success = await playerRepository.evolveCharacter(char.id)
    if (success) {
      const toStage = stage + 1
      setEvoChar({ char, toStage })
      onNotify?.(`✨ Evolucionó: ${char.name} → Stage ${toStage}`)
    }
  }, [playerProxy, onNotify])

  const handleOverlayDone = useCallback(() => {
    // Auto-dismiss after the exit animation completes (~1 s total)
    setTimeout(() => setEvoChar(null), 800)
  }, [])

  return (
    <div className="character-collection">
      <h2 className="section-heading">Colección</h2>
      <p className="section-sub">
        Coleccionados: <strong>{ownedCount} / {total}</strong>
      </p>

      {/* Rarity filter chips */}
      <div className="shop-filters" role="group" aria-label="Filtrar colección por rareza">
        {RARITIES.map((r) => (
          <button
            key={r}
            className={`filter-chip rarity-${r} ${filter === r ? 'filter-chip-active' : ''}`}
            onClick={() => setFilter(r)}
            type="button"
          >
            {r === 'all' ? 'Todos' : RARITY_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="character-grid">
        {visible.map((char) => {
          const isOwned = unlockedSet.has(char.id)
          const stage = isOwned ? getStage(char.id, playerProxy) : null
          const canEvo = isOwned && canEvolve(char.id, playerProxy)
          const cost = isOwned ? evolveCost(char.id, char.rarity, playerProxy) : null
          const canAfford = cost !== null && coins >= cost

          return (
            <div
              key={char.id}
              className={`character-card ${isOwned ? `rarity-border-${char.rarity} character-owned` : 'character-locked'}`}
            >
              <div className="char-emoji">{isOwned ? char.emoji : '❓'}</div>
              <div className="char-name">{isOwned ? char.name : '???'}</div>
              {isOwned && (
                <>
                  <span className={`rarity-badge rarity-${char.rarity}`}>
                    {RARITY_LABELS[char.rarity]}
                  </span>
                  <span className="char-stage-badge">
                    {STAGE_LABELS[stage]}
                  </span>
                  <div className="char-lore">{char.shortLore}</div>
                  {canEvo && (
                    <button
                      className="btn-evolve"
                      disabled={!canAfford}
                      onClick={() => handleEvolve(char)}
                      type="button"
                      title={canAfford ? `Evolucionar a Stage ${stage + 1}` : 'Monedas insuficientes'}
                    >
                      {`Evolucionar (${cost} 🪙)`}
                    </button>
                  )}
                  {!canEvo && (
                    <span className="char-max-stage">MAX ⭐</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Evolution overlay */}
      <AnimatePresence>
        {evoChar && (
          <EvoOverlay
            key={`${evoChar.char.id}-${evoChar.toStage}`}
            char={evoChar.char}
            toStage={evoChar.toStage}
            onDone={handleOverlayDone}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
