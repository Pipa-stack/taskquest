import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHARACTER_CATALOG } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'

const RARITIES = ['all', 'common', 'rare', 'epic', 'legendary']

const RARITY_LABELS = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

/**
 * Character shop tab.
 * Shows the full character catalog with rarity filters.
 * Players can buy characters with coins; purchases are reflected instantly (Dexie offline-first).
 */
export default function CharacterShop({ coins, unlockedCharacters, onNotify }) {
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  const unlockedSet = new Set(unlockedCharacters)

  const handleBuy = useCallback(
    async (character) => {
      if (busy) return
      setBusy(character.id)
      try {
        const success = await playerRepository.buyCharacter(character.id)
        if (success) {
          onNotify(`🪙 Comprado: ${character.name}`)
        }
      } finally {
        setBusy(null)
      }
    },
    [busy, onNotify]
  )

  const visible = filter === 'all'
    ? CHARACTER_CATALOG
    : CHARACTER_CATALOG.filter((c) => c.rarity === filter)

  return (
    <div className="character-shop">
      <h2 className="section-heading">Tienda de Personajes</h2>
      <p className="section-sub">
        Monedas disponibles: <strong>{coins ?? 0} 🪙</strong>
      </p>

      {/* Rarity filter chips */}
      <div className="shop-filters" role="group" aria-label="Filtrar por rareza">
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

      {/* Character grid */}
      <div className="character-grid">
        <AnimatePresence mode="popLayout">
          {visible.map((char) => {
            const isOwned = unlockedSet.has(char.id)
            const canAfford = (coins ?? 0) >= char.priceCoins
            const isBuying = busy === char.id

            return (
              <motion.div
                key={char.id}
                className={`character-card rarity-border-${char.rarity} ${isOwned ? 'character-owned' : ''}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18 }}
              >
                <div className="char-emoji">{char.emoji}</div>
                <div className="char-name">{char.name}</div>
                <span className={`rarity-badge rarity-${char.rarity}`}>
                  {RARITY_LABELS[char.rarity]}
                </span>
                <div className="char-lore">{char.shortLore}</div>
                <div className="char-footer">
                  {isOwned ? (
                    <motion.span
                      className="char-owned-badge"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                      Comprado ✓
                    </motion.span>
                  ) : (
                    <button
                      className="btn-buy"
                      disabled={!canAfford || isBuying || !!busy}
                      onClick={() => handleBuy(char)}
                      type="button"
                    >
                      {isBuying ? '…' : `${char.priceCoins} 🪙`}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
