import { CHARACTERS } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'

const MAX_TEAM = 3

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

/**
 * Renders the character collection and active team management UI.
 * Team slots rendered as compact chips with rarity border + stage.
 * Character cards show rarity badge and team state.
 *
 * Props:
 *   xp                – current player XP (for buy button)
 *   unlockedCharacters – string[] of unlocked character ids
 *   activeTeam         – string[] of up to 3 character ids
 *   onNotify           – callback(message: string) for toast notifications
 */
export default function CharacterCollection({ xp, unlockedCharacters, activeTeam, onNotify }) {
  const unlockedSet = new Set(unlockedCharacters)
  const teamSet = new Set(activeTeam)

  const handleBuy = async (character) => {
    if (xp < character.cost) {
      onNotify?.(`Necesitas ${character.cost} XP para desbloquear a ${character.name}`)
      return
    }
    const ok = await playerRepository.spendXpOnCharacter({
      characterId: character.id,
      costXP: character.cost,
    })
    if (ok) onNotify?.(`¡${character.name} desbloqueado! 🎉`)
  }

  const handleAdd = async (character) => {
    const ok = await playerRepository.addToTeam(character.id)
    if (!ok) onNotify?.('El equipo ya está completo (máx 3)')
  }

  const handleRemove = async (character) => {
    await playerRepository.removeFromTeam(character.id)
  }

  return (
    <div className="char-collection">
      {/* Active team chips */}
      <section className="team-section">
        <div className="team-section-header">
          <h3 className="team-title">Equipo activo ({activeTeam.length}/{MAX_TEAM})</h3>
          <span className="team-subtitle">Tu equipo aumenta el farmeo de monedas</span>
        </div>
        <div className="team-chips-row">
          {Array.from({ length: MAX_TEAM }, (_, i) => {
            const charId = activeTeam[i]
            const char   = charId ? CHARACTERS.find((c) => c.id === charId) : null
            const color  = char ? (RARITY_COLORS[char.rarity] ?? '#4a4a6a') : '#2a2a3e'
            return (
              <div
                key={i}
                className={`team-chip ${char ? 'team-chip--filled' : 'team-chip--empty'}`}
                style={{ borderColor: color }}
                title={char ? `${char.name} · ${RARITY_LABELS[char.rarity] ?? char.rarity} · Stage ${char.stage}` : 'Slot vacío'}
              >
                {char ? (
                  <>
                    <span className="team-chip-emoji">{char.emoji}</span>
                    <span className="team-chip-stage" style={{ color }}>{char.stage}</span>
                    <span className="team-chip-name">{char.name}</span>
                  </>
                ) : (
                  <span className="team-chip-plus">+</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Character cards */}
      <section className="chars-grid-section">
        <h3 className="chars-grid-title">Colección</h3>
        <div className="chars-grid">
          {CHARACTERS.map((char) => {
            const isUnlocked = unlockedSet.has(char.id)
            const inTeam     = teamSet.has(char.id)
            const rarityColor = RARITY_COLORS[char.rarity] ?? '#6b7280'

            return (
              <div
                key={char.id}
                className={`char-card ${isUnlocked ? 'char-card--unlocked' : 'char-card--locked'}`}
                style={{ borderColor: isUnlocked ? rarityColor : undefined }}
              >
                {/* Rarity stripe */}
                <div className="char-rarity-stripe" style={{ background: rarityColor }} />

                <div className="char-card-emoji">{char.emoji}</div>
                <div className="char-card-name">{char.name}</div>
                <div className="char-card-rarity" style={{ color: rarityColor }}>
                  {RARITY_LABELS[char.rarity] ?? char.rarity}
                </div>

                {inTeam && (
                  <span className="char-in-team-badge">En equipo</span>
                )}

                {isUnlocked ? (
                  inTeam ? (
                    <button
                      className="char-btn char-btn--remove"
                      onClick={() => handleRemove(char)}
                    >
                      Quitar
                    </button>
                  ) : (
                    <button
                      className="char-btn char-btn--add"
                      onClick={() => handleAdd(char)}
                      disabled={activeTeam.length >= MAX_TEAM}
                    >
                      Al equipo
                    </button>
                  )
                ) : (
                  <button
                    className="char-btn char-btn--buy"
                    onClick={() => handleBuy(char)}
                    disabled={xp < char.cost}
                    title={`Coste: ${char.cost} XP`}
                  >
                    {char.cost} XP
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
