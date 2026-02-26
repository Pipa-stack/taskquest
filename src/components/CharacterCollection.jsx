import { CHARACTERS, EVOLUTION_COSTS } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'

const MAX_TEAM = 3

const RARITY_LABELS = {
  common: 'Común',
  uncommon: 'Infrecuente',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

/**
 * Renders the character collection and active team management UI.
 *
 * Props:
 *   coins             – current player coins (for buy/evolve buttons)
 *   unlockedCharacters – string[] of unlocked character ids
 *   activeTeam         – string[] of up to 3 character ids
 *   characterStages    – object mapping characterId → stage number (1 or 2)
 *   onNotify           – callback(message: string) for toast notifications
 */
export default function CharacterCollection({ coins, unlockedCharacters, activeTeam, characterStages, onNotify }) {
  const unlockedSet = new Set(unlockedCharacters)
  const teamSet = new Set(activeTeam)

  const handleBuy = async (character) => {
    const ok = await playerRepository.buyCharacter(character.id)
    if (ok) {
      onNotify?.(`🪙 Comprado: ${character.name}`)
    } else if (!unlockedSet.has(character.id)) {
      onNotify?.(`Necesitas ${character.priceCoins} 🪙 para desbloquear a ${character.name}`)
    }
  }

  const handleEvolve = async (character) => {
    const ok = await playerRepository.evolveCharacter(character.id)
    if (ok) {
      onNotify?.(`✨ Evolucionó: ${character.name} → Etapa II`)
    } else {
      const cost = EVOLUTION_COSTS[character.rarity]
      onNotify?.(`Necesitas ${cost} 🪙 para evolucionar a ${character.name}`)
    }
  }

  const handleAdd = async (character) => {
    const ok = await playerRepository.addToTeam(character.id)
    if (!ok) {
      onNotify?.('El equipo ya está completo (máx 3)')
    }
  }

  const handleRemove = async (character) => {
    await playerRepository.removeFromTeam(character.id)
  }

  return (
    <div className="char-collection">
      {/* Active team slots */}
      <section className="team-section">
        <h3 className="team-title">Tu equipo ({activeTeam.length}/{MAX_TEAM})</h3>
        <div className="team-slots">
          {Array.from({ length: MAX_TEAM }, (_, i) => {
            const charId = activeTeam[i]
            const char = charId ? CHARACTERS.find((c) => c.id === charId) : null
            const stage = charId ? (characterStages?.[charId] ?? 1) : null
            return (
              <div key={i} className={`team-slot ${char ? 'team-slot--filled' : 'team-slot--empty'}`}>
                {char ? (
                  <>
                    <span className="team-slot-emoji">{char.emoji}</span>
                    <span className="team-slot-stage">
                      {stage === 2 ? 'II' : 'I'}
                    </span>
                  </>
                ) : (
                  <span className="team-slot-plus">+</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Character cards */}
      <section className="chars-grid-section">
        <h3 className="chars-grid-title">Personajes</h3>
        <div className="chars-grid">
          {CHARACTERS.map((char) => {
            const isUnlocked = unlockedSet.has(char.id)
            const inTeam = teamSet.has(char.id)
            const stage = isUnlocked ? (characterStages?.[char.id] ?? 1) : null
            const isMaxStage = stage === 2
            const evolutionCost = EVOLUTION_COSTS[char.rarity]
            const canAfford = coins >= char.priceCoins
            const canAffordEvolve = coins >= evolutionCost

            return (
              <div
                key={char.id}
                className={`char-card char-card--${char.rarity} ${isUnlocked ? 'char-card--unlocked' : 'char-card--locked'}`}
              >
                <div className="char-card-emoji">{char.emoji}</div>
                <div className="char-card-name">{char.name}</div>
                <div className={`char-card-rarity char-rarity--${char.rarity}`}>
                  {RARITY_LABELS[char.rarity]}
                </div>
                <div className="char-card-lore">{char.shortLore}</div>

                {isUnlocked && (
                  <div className="char-card-stage">
                    Etapa {stage === 2 ? 'II' : 'I'}
                  </div>
                )}

                {inTeam && (
                  <span className="char-in-team-badge">En equipo</span>
                )}

                {isUnlocked ? (
                  <div className="char-card-actions">
                    {inTeam ? (
                      <button
                        className="char-btn char-btn--remove"
                        onClick={() => handleRemove(char)}
                      >
                        Quitar del equipo
                      </button>
                    ) : (
                      <button
                        className="char-btn char-btn--add"
                        onClick={() => handleAdd(char)}
                        disabled={activeTeam.length >= MAX_TEAM}
                      >
                        Añadir al equipo
                      </button>
                    )}
                    {!isMaxStage && (
                      <button
                        className="char-btn char-btn--evolve"
                        onClick={() => handleEvolve(char)}
                        disabled={!canAffordEvolve}
                        title={`Coste: ${evolutionCost} 🪙`}
                      >
                        Evolucionar ({evolutionCost} 🪙)
                      </button>
                    )}
                    {isMaxStage && (
                      <span className="char-max-stage">✨ Etapa máxima</span>
                    )}
                  </div>
                ) : (
                  <button
                    className="char-btn char-btn--buy"
                    onClick={() => handleBuy(char)}
                    disabled={!canAfford}
                    title={`Coste: ${char.priceCoins} 🪙`}
                  >
                    Comprar ({char.priceCoins} 🪙)
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
