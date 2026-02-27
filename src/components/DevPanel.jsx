import { useState, useEffect } from 'react'
import { CAPS, PLAYER_DEFAULTS, BOOST_CFG, ZONE_ECONOMY, GACHA_CFG, DAILY_LOOP_CFG } from '../domain/config.js'

/**
 * DevPanel — developer tools overlay for TaskQuest.
 *
 * Activation:
 *   - URL param:    ?dev=1  (persisted to localStorage on first visit)
 *   - localStorage: taskquest.dev = 'true'
 *   - Dismissable:  'Hide DevPanel' button clears localStorage flag
 *
 * Features:
 *   - Player state snapshot (formatted JSON)
 *   - Export player state to clipboard
 *   - Active balance config table (from config.js)
 *   - Computed economy metrics (ROI, hours to unlock, etc.)
 */

const LS_KEY = 'taskquest.dev'

/** Returns true if dev mode is active. */
export function isDevMode() {
  try {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    if (params.get('dev') === '1') {
      localStorage.setItem(LS_KEY, 'true')
      return true
    }
    return localStorage.getItem(LS_KEY) === 'true'
  } catch (_) {
    return false
  }
}

export default function DevPanel({ player, powerScore }) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleExport = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(player, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch (_) {
      // Fallback: alert
      alert(JSON.stringify(player, null, 2))
    }
  }

  const handleHide = () => {
    try { localStorage.removeItem(LS_KEY) } catch (_) {}
    setOpen(false)
  }

  if (!open) return (
    <button
      className="dev-panel-reopen"
      onClick={() => setOpen(true)}
      title="Re-open DevPanel"
    >
      🛠 DEV
    </button>
  )

  // Computed economy metrics
  const baseCpm = player.coinsPerMinuteBase ?? 1
  const coinsPerHour = baseCpm * 60

  return (
    <div className="dev-panel">
      <div className="dev-panel-header">
        <span className="dev-panel-title">🛠 DevPanel</span>
        <div className="dev-panel-header-btns">
          <button onClick={handleExport} className="dev-btn">
            {copied ? '✓ Copied!' : '📋 Export state'}
          </button>
          <button onClick={handleHide} className="dev-btn dev-btn-hide">
            Hide
          </button>
        </div>
      </div>

      {/* Player snapshot */}
      <section className="dev-section">
        <h4 className="dev-section-title">Player snapshot</h4>
        <table className="dev-table">
          <tbody>
            {[
              ['XP', player.xp ?? 0],
              ['Level', player.level ?? 1],
              ['Streak', player.streak ?? 0],
              ['Coins', player.coins ?? 0],
              ['Energy', `${player.energy ?? 100} / ${player.energyCap ?? 100}`],
              ['CPM base', baseCpm],
              ['Power', powerScore ?? 0],
              ['Zone', player.currentZone ?? 1],
              ['Zone max', player.zoneUnlockedMax ?? 1],
              ['Essence', player.essence ?? 0],
              ['Talents', JSON.stringify(player.talents ?? {})],
              ['Boosts', (player.boosts ?? []).length],
              ['syncStatus', player.syncStatus ?? '—'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="dev-td-key">{k}</td>
                <td className="dev-td-val">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Balance config */}
      <section className="dev-section">
        <h4 className="dev-section-title">Balance config (config.js)</h4>
        <table className="dev-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Gacha pull cost</td><td>{GACHA_CFG.pullCost} 🪙</td></tr>
            <tr><td>Daily loop reward</td><td>+{DAILY_LOOP_CFG.rewardCoins}🪙 +{DAILY_LOOP_CFG.rewardEssence}✨</td></tr>
            <tr><td>Boost x2/30m cost</td><td>{BOOST_CFG.coin_x2_30m.cost} 🪙</td></tr>
            <tr><td>Boost x2/2h cost</td><td>{BOOST_CFG.coin_x2_2h.cost} 🪙</td></tr>
            <tr><td>Energy refill cost</td><td>{BOOST_CFG.energy_refill.cost} 🪙</td></tr>
            <tr><td>Zone 2 unlock</td><td>{ZONE_ECONOMY[2].unlockCostCoins} 🪙</td></tr>
            <tr><td>Zone 3 unlock</td><td>{ZONE_ECONOMY[3].unlockCostCoins} 🪙</td></tr>
            <tr><td>Zone 6 unlock</td><td>{ZONE_ECONOMY[6].unlockCostCoins} 🪙</td></tr>
            <tr><td>Max coins cap</td><td>{CAPS.coins.toLocaleString()}</td></tr>
            <tr><td>Max energy cap</td><td>{CAPS.energyCap}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Economy metrics */}
      <section className="dev-section">
        <h4 className="dev-section-title">Economy metrics (current player)</h4>
        <table className="dev-table">
          <tbody>
            <tr><td>Coins/hour (base)</td><td>{coinsPerHour}</td></tr>
            <tr><td>Hrs to zone 2 unlock</td><td>{(ZONE_ECONOMY[2].unlockCostCoins / coinsPerHour).toFixed(1)} h</td></tr>
            <tr><td>Hrs to zone 3 unlock</td><td>{(ZONE_ECONOMY[3].unlockCostCoins / coinsPerHour).toFixed(1)} h</td></tr>
            <tr><td>Boost x2/30m ROI</td><td>{((baseCpm * 30) / BOOST_CFG.coin_x2_30m.cost).toFixed(2)}×</td></tr>
            <tr><td>Boost x2/2h ROI</td><td>{((baseCpm * 120) / BOOST_CFG.coin_x2_2h.cost).toFixed(2)}×</td></tr>
            <tr><td>Energy refill ROI</td><td>{(((player.energyCap ?? 100) * baseCpm) / BOOST_CFG.energy_refill.cost).toFixed(2)}×</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
