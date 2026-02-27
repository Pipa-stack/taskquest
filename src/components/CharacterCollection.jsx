import { CHARACTERS } from '../domain/characters.js'
import { playerRepository } from '../repositories/playerRepository.js'
import { GACHA_PULL_COST } from '../domain/gacha.js'

const MAX_TEAM = 3

const RARITY_LABEL = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

/**
 * Renders the character collection and active team management UI.
 *
 * Props:
 *   xp                – current player XP (for buy button)
 *   coins             – current coins (for gacha pull)
 *   unlockedCharacters – string[] of unlocked character ids
 *   activeTeam         – string[] of up to 3 character ids
 *   onNotify           – callback(message: string) for toast notifications
 */
export default function CharacterCollection({ xp, coins, unlockedCharacters, activeTeam, onNotify }) {
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
    if (ok) {
      onNotify?.(`¡${character.name} desbloqueado! 🎉`)
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

  const handleGachaPull = async () => {
    const result = await playerRepository.pullGacha(Date.now())
    if (!result) {
      onNotify?.(`Necesitas ${GACHA_PULL_COST} monedas para hacer un pull`)
      return
    }
    const { rarity, characterId } = result
    const char = CHARACTERS.find((c) => c.id === characterId)
    const rarityLabel = RARITY_LABEL[rarity] ?? rarity
    if (char) {
      const isNew = !(unlockedCharacters ?? []).includes(characterId)
      onNotify?.(isNew
        ? `🎰 [${rarityLabel}] ¡${char.name} desbloqueado! 🎉`
        : `🎰 [${rarityLabel}] ${char.name} (ya lo tenías)`)
    } else {
      onNotify?.(`🎰 Pull realizado: ${rarityLabel}`)
    }
  }

  return (
    <div className="char-collection">
      {/* Gacha pull section */}
      <section className="gacha-section">
        <h3 className="gacha-title">🎰 Gacha</h3>
        <p className="gacha-desc">
          Gasta <strong>{GACHA_PULL_COST} monedas</strong> para un pull aleatorio.
          Monedas actuales: <strong>{coins ?? 0}</strong>
        </p>
        <button
          className="gacha-pull-btn"
          onClick={handleGachaPull}
          disabled={(coins ?? 0) < GACHA_PULL_COST}
        >
          Pull ({GACHA_PULL_COST} 🪙)
        </button>
      </section>

      {/* Active team slots */}
      <section className="team-section">
        <h3 className="team-title">Tu equipo ({activeTeam.length}/{MAX_TEAM})</h3>
        <div className="team-slots">
          {Array.from({ length: MAX_TEAM }, (_, i) => {
            const charId = activeTeam[i]
            const char = charId ? CHARACTERS.find((c) => c.id === charId) : null
            return (
              <div key={i} className={`team-slot ${char ? 'team-slot--filled' : 'team-slot--empty'}`}>
                {char ? (
                  <>
                    <span className="team-slot-emoji">{char.emoji}</span>
                    <span className="team-slot-stage">{char.stage}</span>
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

            return (
              <div
                key={char.id}
                className={`char-card ${isUnlocked ? 'char-card--unlocked' : 'char-card--locked'}`}
              >
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
