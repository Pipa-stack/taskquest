import { useState } from 'react'
import { motion } from 'framer-motion'
import { PACK_CATALOG } from '../domain/gacha.js'
import { playerRepository } from '../repositories/playerRepository.js'
import PackOpeningModal from './PackOpeningModal.jsx'

/**
 * GachaShop – displays available packs with cost, lets player buy and open them.
 *
 * Props:
 *   coins         – current coin balance
 *   dust          – current dust balance
 *   pityLegendary – current pity counter
 *   unlockedCharacters – string[] of owned character ids
 *   onNotify      – callback(message: string)
 */
export default function GachaShop({ coins, dust, pityLegendary, unlockedCharacters, onNotify }) {
  const [pendingPulls, setPendingPulls] = useState(null) // Array of pull results to show in modal

  const handleBuy = async (pack) => {
    if ((coins ?? 0) < pack.cost) {
      onNotify?.(`Necesitas ${pack.cost} 🪙 para este pack`)
      return
    }
    const { success, pulls } = await playerRepository.buyPack(pack.id, Date.now())
    if (success) {
      setPendingPulls(pulls)
    } else {
      onNotify?.('No se pudo abrir el pack')
    }
  }

  const pityLeft = Math.max(0, 30 - (pityLegendary ?? 0))

  return (
    <div className="gacha-shop">
      <div className="gacha-shop-header">
        <h2 className="section-heading">Gacha · Packs</h2>
        <p className="gacha-shop-sub">Abre packs para conseguir personajes</p>
      </div>

      {/* Balance strip */}
      <div className="gacha-balance-strip">
        <span className="gacha-balance-item">
          <span className="gacha-balance-icon">🪙</span>
          <span className="gacha-balance-val">{coins ?? 0}</span>
        </span>
        <span className="gacha-balance-sep">·</span>
        <span className="gacha-balance-item">
          <span className="gacha-balance-icon">💨</span>
          <span className="gacha-balance-val">{dust ?? 0} polvo</span>
        </span>
        <span className="gacha-balance-sep">·</span>
        <span className="gacha-pity-hint" title="Pulls sin legendario">
          ⚡ Pity {(pityLegendary ?? 0)}/{30} — {pityLeft} para guaranteed
        </span>
      </div>

      {/* Pack cards */}
      <div className="gacha-packs">
        {PACK_CATALOG.map((pack) => {
          const canAfford = (coins ?? 0) >= pack.cost
          return (
            <motion.div
              key={pack.id}
              className={`gacha-pack-card ${canAfford ? '' : 'gacha-pack-card--locked'}`}
              whileHover={canAfford ? { scale: 1.02, y: -2 } : {}}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="gacha-pack-emoji">{pack.emoji}</div>
              <div className="gacha-pack-info">
                <div className="gacha-pack-name">{pack.label}</div>
                <div className="gacha-pack-pulls">{pack.pulls} {pack.pulls === 1 ? 'pull' : 'pulls'}{pack.guaranteeRare ? ' · garantiza Raro+' : ''}</div>
              </div>
              <button
                className={`gacha-pack-btn ${canAfford ? 'gacha-pack-btn--active' : ''}`}
                onClick={() => handleBuy(pack)}
                disabled={!canAfford}
              >
                {pack.cost} 🪙
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Drop rates info */}
      <details className="gacha-rates-details">
        <summary className="gacha-rates-summary">Ver tasas de obtención</summary>
        <div className="gacha-rates-grid">
          {[
            { rarity: 'Común',       rate: '70%',   color: '#6b7280' },
            { rarity: 'Poco común',  rate: '20%',   color: '#22c55e' },
            { rarity: 'Raro',        rate: '8%',    color: '#3b82f6' },
            { rarity: 'Épico',       rate: '1.8%',  color: '#a855f7' },
            { rarity: 'Legendario',  rate: '0.2%',  color: '#f59e0b' },
          ].map(({ rarity, rate, color }) => (
            <div key={rarity} className="gacha-rate-row">
              <span className="gacha-rate-dot" style={{ background: color }} />
              <span className="gacha-rate-rarity" style={{ color }}>{rarity}</span>
              <span className="gacha-rate-pct">{rate}</span>
            </div>
          ))}
          <div className="gacha-pity-note">
            Pity: tras 30 pulls sin legendario → siguiente garantizado
          </div>
        </div>
      </details>

      {/* Pack opening modal */}
      {pendingPulls && (
        <PackOpeningModal
          pulls={pendingPulls}
          onClose={() => setPendingPulls(null)}
        />
      )}
    </div>
  )
}
