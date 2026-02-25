import { useState } from 'react'
import { CHARACTER_CATALOG } from '../domain/characters.js'

const RARITIES = ['all', 'common', 'rare', 'epic', 'legendary']

const RARITY_LABELS = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

/**
 * Character collection view.
 * Shows all characters — unlocked ones revealed, locked ones as "???".
 * Included inside the "Tienda" tab below the shop.
 */
export default function CharacterCollection({ unlockedCharacters }) {
  const [filter, setFilter] = useState('all')

  const unlockedSet = new Set(unlockedCharacters)
  const total = CHARACTER_CATALOG.length
  const ownedCount = CHARACTER_CATALOG.filter((c) => unlockedSet.has(c.id)).length

  const visible = filter === 'all'
    ? CHARACTER_CATALOG
    : CHARACTER_CATALOG.filter((c) => c.rarity === filter)

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
          return (
            <div
              key={char.id}
              className={`character-card ${isOwned ? `rarity-border-${char.rarity} character-owned` : 'character-locked'}`}
            >
              <div className="char-emoji">{isOwned ? char.emoji : '❓'}</div>
              <div className="char-name">{isOwned ? char.name : '???'}</div>
              {isOwned && (
                <span className={`rarity-badge rarity-${char.rarity}`}>
                  {RARITY_LABELS[char.rarity]}
                </span>
              )}
              {isOwned && <div className="char-lore">{char.shortLore}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
