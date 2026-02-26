import { CHARACTERS } from '../domain/characters.js'
import { calcTeamMultiplier } from '../domain/idle.js'

const RARITY_COLORS = {
  common:    '#9ca3af',
  uncommon:  '#4ade80',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#fbbf24',
}

const RARITY_LABEL = {
  common:    'Común',
  uncommon:  'Inusual',
  rare:      'Raro',
  epic:      'Épico',
  legendary: 'Legendario',
}

/**
 * TeamPanel — shows the 3 active team slots with rarity/stage info
 * and the computed team idle multiplier.
 *
 * Props:
 *   activeTeam  {string[]} – character ids in active team (max 3)
 *   onNavigate  {Function} – callback(tabName) to switch tabs
 */
export default function TeamPanel({ activeTeam, onNavigate }) {
  const safeTeam = activeTeam ?? []
  const teamChars = safeTeam
    .map((id) => CHARACTERS.find((c) => c.id === id))
    .filter(Boolean)

  const multiplier = calcTeamMultiplier(safeTeam, {}, CHARACTERS)

  return (
    <div className="team-panel">
      <div className="team-panel-header">
        <h3 className="team-panel-title">Equipo de Farmeo</h3>
        <span className="team-panel-mult" title="Multiplicador de monedas del equipo">
          ×{multiplier.toFixed(2)}
        </span>
      </div>
      <p className="team-panel-hint">
        Multiplica tu ganancia según la rareza del equipo
      </p>

      <div className="team-panel-slots">
        {Array.from({ length: 3 }, (_, i) => {
          const char = teamChars[i]
          const rarityColor = char ? (RARITY_COLORS[char.rarity] ?? '#9ca3af') : undefined
          return (
            <div
              key={i}
              className={`tp-slot${char ? ' tp-slot--filled' : ''}`}
              style={char ? { borderColor: rarityColor + '99' } : {}}
            >
              {char ? (
                <>
                  <span className="tp-emoji">{char.emoji}</span>
                  <span className="tp-name">{char.name}</span>
                  <span
                    className="tp-rarity"
                    style={{ color: rarityColor }}
                  >
                    {RARITY_LABEL[char.rarity] ?? char.rarity}
                  </span>
                  <span className="tp-stage">Etapa {char.stage}</span>
                </>
              ) : (
                <>
                  <span className="tp-empty-icon">+</span>
                  <span className="tp-empty-text">vacío</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {safeTeam.length === 0 && (
        <p className="team-panel-empty">Sin equipo activo — multiplicador ×1.00</p>
      )}

      {onNavigate && (
        <button
          className="team-panel-cta"
          onClick={() => onNavigate('Colección')}
          type="button"
        >
          👥 Gestionar equipo →
        </button>
      )}
    </div>
  )
}
