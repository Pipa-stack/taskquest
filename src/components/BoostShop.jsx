import { BOOST_CATALOG, getActiveBoosts } from '../domain/boosts.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * BoostShop — lets the player spend coins on temporary boosts.
 *
 * Props:
 *   coins   {number}   – current coin balance
 *   boosts  {Array}    – active boosts array from player
 *   onNotify {Function} – callback(message) to show a toast notification
 */
export default function BoostShop({ coins, boosts, onNotify }) {
  const nowMs = Date.now()
  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
  const activeIds = new Set(activeBoostList.map((b) => b.id))

  const handleBuy = async (boost) => {
    const ok = await playerRepository.buyBoost(boost.id, Date.now())
    if (ok) {
      if (onNotify) onNotify(`🚀 Boost activado: ${boost.label}`)
    } else {
      if (onNotify) onNotify('Sin monedas suficientes')
    }
  }

  return (
    <div className="boost-shop">
      <h2 className="boost-shop-title">Tienda de Boosts</h2>
      <p className="boost-shop-balance">
        🪙 Monedas disponibles: <strong>{coins ?? 0}</strong>
      </p>
      <ul className="boost-list">
        {BOOST_CATALOG.map((boost) => {
          const canAfford = (coins ?? 0) >= boost.cost
          const isActive = activeIds.has(boost.id)
          const activeEntry = activeBoostList.find((b) => b.id === boost.id)
          const remainingMin = activeEntry
            ? Math.max(0, Math.ceil((activeEntry.expiresAt - nowMs) / 60_000))
            : null

          return (
            <li key={boost.id} className={`boost-item ${isActive ? 'boost-item-active' : ''}`}>
              <div className="boost-item-info">
                <span className="boost-item-label">{boost.label}</span>
                {isActive && remainingMin !== null && (
                  <span className="boost-item-timer"> ({remainingMin}m restantes)</span>
                )}
                {isActive && remainingMin === null && (
                  <span className="boost-item-timer"> (activo)</span>
                )}
              </div>
              <button
                className="boost-buy-btn"
                onClick={() => handleBuy(boost)}
                disabled={!canAfford}
                title={canAfford ? `Comprar: ${boost.cost} monedas` : 'Monedas insuficientes'}
                type="button"
              >
                🪙 {boost.cost}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
