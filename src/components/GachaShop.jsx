import { useState } from 'react'
import { playerRepository } from '../repositories/playerRepository.js'
import { BASE_RATES } from '../domain/gacha.js'
import { computeTalentBonuses } from '../domain/talents.js'

const PULL_COST = 30

const RARITY_COLORS = {
  common:    '#94a3b8',
  uncommon:  '#4ade80',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#fbbf24',
}

const RARITY_LABELS = {
  common:    'Común',
  uncommon:  'Poco común',
  rare:      'Rara',
  epic:      'Épica',
  legendary: 'Legendaria',
}

/**
 * GachaShop — lets the player spend 30 coins to pull a random character.
 *
 * Props:
 *   coins    {number} – current coin balance
 *   talents  {object} – talent levels { idle, gacha, power }
 *   gachaPityCount {number} – current pity counter
 *   onNotify {Function} – callback(message) for toast notifications
 */
export default function GachaShop({ coins, talents, gachaPityCount, onNotify }) {
  const [lastResult, setLastResult] = useState(null)
  const [pulling, setPulling] = useState(false)

  const canAfford = (coins ?? 0) >= PULL_COST

  const { gachaRareBonus, pityReduction } = computeTalentBonuses(talents ?? {})
  const effectivePity = Math.max(20, 30 - Math.floor((talents?.gacha ?? 0) / 2))
  const pityLeft = Math.max(0, effectivePity - (gachaPityCount ?? 0) - 1)

  const handlePull = async () => {
    if (!canAfford || pulling) return
    setPulling(true)
    try {
      const result = await playerRepository.pullGacha(Date.now())
      if (!result) {
        onNotify?.('Sin monedas suficientes (30 🪙 por pull)')
        return
      }
      setLastResult(result)
      if (result.isNew) {
        onNotify?.(`🎉 ¡${result.character?.name ?? 'Personaje'} (${RARITY_LABELS[result.rarity]}) desbloqueado!`)
      } else if (result.essenceBonus > 0) {
        onNotify?.(`Duplicado — +${result.essenceBonus} esencia`)
      } else {
        onNotify?.(`Pull: ${RARITY_LABELS[result.rarity] ?? result.rarity}`)
      }
    } finally {
      setPulling(false)
    }
  }

  return (
    <div className="gacha-shop">
      <h2 className="gacha-title">⭐ Gacha</h2>
      <p className="gacha-balance">
        🪙 Monedas: <strong>{coins ?? 0}</strong>
        <span className="gacha-cost"> · Coste: {PULL_COST} por pull</span>
      </p>

      {/* Pity info */}
      <p className="gacha-pity">
        🔮 Pity: <strong>{gachaPityCount ?? 0}</strong> / {effectivePity}
        {pityLeft <= 5 && pityLeft >= 0 && (
          <span className="gacha-pity-warning"> — ¡{pityLeft + 1} pull{pityLeft === 0 ? '' : 's'} para garantizado!</span>
        )}
      </p>

      {/* Drop rates summary */}
      <div className="gacha-rates">
        {Object.entries(BASE_RATES).map(([rarity, prob]) => (
          <span key={rarity} className="gacha-rate-chip" style={{ color: RARITY_COLORS[rarity] }}>
            {RARITY_LABELS[rarity]} {Math.round((prob + (rarity === 'rare' ? gachaRareBonus ?? 0 : 0)) * 100)}%
          </span>
        ))}
      </div>

      {/* Pull button */}
      <button
        className="gacha-pull-btn"
        onClick={handlePull}
        disabled={!canAfford || pulling}
        type="button"
        title={canAfford ? `Pull por ${PULL_COST} 🪙` : 'Monedas insuficientes'}
      >
        {pulling ? '⏳ Abriendo...' : `🎰 Pull (${PULL_COST} 🪙)`}
      </button>

      {/* Last result */}
      {lastResult && (
        <div
          className="gacha-result"
          style={{ borderColor: RARITY_COLORS[lastResult.rarity] }}
        >
          <div className="gacha-result-rarity" style={{ color: RARITY_COLORS[lastResult.rarity] }}>
            {RARITY_LABELS[lastResult.rarity] ?? lastResult.rarity}
          </div>
          {lastResult.character ? (
            <div className="gacha-result-character">
              <span className="gacha-result-emoji">{lastResult.character.emoji}</span>
              <span className="gacha-result-name">{lastResult.character.name}</span>
              {lastResult.isNew ? (
                <span className="gacha-result-badge gacha-result-new">¡NUEVO!</span>
              ) : (
                <span className="gacha-result-badge gacha-result-dupe">
                  Duplicado · +{lastResult.essenceBonus} ✨
                </span>
              )}
            </div>
          ) : (
            <div className="gacha-result-character">
              <span className="gacha-result-name">+{lastResult.essenceBonus} ✨ Esencia</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
