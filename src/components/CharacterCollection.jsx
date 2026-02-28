import { CHARACTERS } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'

const MAX_TEAM = 3

const RARITY_LABEL = {
  common:    'Común',
  uncommon:  'Poco común',
  rare:      'Raro',
  epic:      'Épico',
  legendary: 'Legendario',
}

/**
 * Character collection with rarity-striped cards and team slot UI.
 */
export default function CharacterCollection({ xp, unlockedCharacters, activeTeam, onNotify }) {
  const unlockedSet = new Set(unlockedCharacters)
  const teamSet     = new Set(activeTeam)

  const handleBuy = async (character) => {
    if (xp < character.cost) {
      onNotify?.(`Necesitas ${character.cost} XP para desbloquear a ${character.name}`)
      return
    }
    const ok = await playerRepository.spendXpOnCharacter({
      characterId: character.id,
      costXP:      character.cost,
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

      {/* ── Active team slots ──────────────────────────────────── */}
      <section className="team-section">
        <h3 className="team-title">Tu equipo ({activeTeam.length}/{MAX_TEAM})</h3>
        <div className="team-slots">
          {Array.from({ length: MAX_TEAM }, (_, i) => {
            const charId = activeTeam[i]
            const char   = charId ? CHARACTERS.find((c) => c.id === charId) : null
            return (
              <div
                key={i}
                className={`team-slot ${char ? 'team-slot--filled' : 'team-slot--empty'}`}
                title={char ? char.name : 'Slot vacío'}
              >
                {char ? (
                  <>
                    <span className="team-slot-emoji">{char.emoji}</span>
                    <span className="team-slot-stage">S{char.stage}</span>
                  </>
                ) : (
                  <span className="team-slot-plus">+</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Character cards ────────────────────────────────────── */}
      <section className="chars-grid-section">
        <h3 className="chars-grid-title">Personajes</h3>
        <div className="chars-grid">
          {CHARACTERS.map((char) => {
            const isUnlocked = unlockedSet.has(char.id)
            const inTeam     = teamSet.has(char.id)

            return (
              <div
                key={char.id}
                className={`char-card ${isUnlocked ? 'char-card--unlocked' : 'char-card--locked'}`}
                data-rarity={char.rarity}
              >
                {/* Rarity badge */}
                <span className="char-rarity-badge">
                  {RARITY_LABEL[char.rarity] ?? char.rarity}
                </span>

                <div className="char-card-emoji">{char.emoji}</div>
                <div className="char-card-name">{char.name}</div>

                {inTeam && (
                  <span className="char-in-team-badge">En equipo</span>
                )}

                {isUnlocked ? (
                  inTeam ? (
                    <button
                      className="char-btn char-btn--remove"
                      onClick={() => handleRemove(char)}
                      aria-label={`Quitar a ${char.name} del equipo`}
                    >
                      Quitar
                    </button>
                  ) : (
                    <button
                      className="char-btn char-btn--add"
                      onClick={() => handleAdd(char)}
                      disabled={activeTeam.length >= MAX_TEAM}
                      aria-label={`Añadir a ${char.name} al equipo`}
                    >
                      + Equipo
                    </button>
                  )
                ) : (
                  <button
                    className="char-btn char-btn--buy"
                    onClick={() => handleBuy(char)}
                    disabled={xp < char.cost}
                    title={`Coste: ${char.cost} XP`}
                    aria-label={`Desbloquear a ${char.name} por ${char.cost} XP`}
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
