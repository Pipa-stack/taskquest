import { BOOST_CATALOG, getActiveBoosts } from '../domain/boosts.js'
import { playerRepository } from '../repositories/playerRepository.js'
import { Card, Badge, Button, Chip, StatRow } from '../ui/index.js'

/**
 * BoostShop — redesigned boost purchase screen using the ui/ design system.
 *
 * Props:
 *  coins   {number}   – current coin balance
 *  boosts  {Array}    – active boosts array from player
 *  onNotify{Function} – toast callback
 */
export default function BoostShop({ coins, boosts, onNotify }) {
  const nowMs          = Date.now()
  const activeBoostList = getActiveBoosts(boosts ?? [], nowMs)
  const activeIds       = new Set(activeBoostList.map((b) => b.id))

  const handleBuy = async (boost) => {
    const ok = await playerRepository.buyBoost(boost.id, Date.now())
    if (ok) {
      onNotify?.(`🚀 Boost activado: ${boost.label}`)
    } else {
      onNotify?.('Monedas insuficientes')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#e2e2e7', margin: 0 }}>
          🚀 Tienda de Boosts
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#5a5a7a', marginTop: '0.25rem' }}>
          Multiplica tus ganancias de monedas temporalmente
        </p>
      </div>

      {/* ── Balance ────────────────────────────────────────── */}
      <StatRow
        icon="🪙"
        label="Monedas disponibles"
        value={(coins ?? 0).toLocaleString('es')}
        valueColor="#fbbf24"
      />

      {/* ── Active boost pills ─────────────────────────────── */}
      {activeBoostList.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeBoostList.map((b) => {
            const remainingMin = Math.max(
              0,
              Math.ceil((b.expiresAt - nowMs) / 60_000)
            )
            return (
              <Chip key={b.id} variant="gold">
                ✓ {remainingMin}m restantes
              </Chip>
            )
          })}
        </div>
      )}

      {/* ── Boost cards ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {BOOST_CATALOG.map((boost) => {
          const canAfford   = (coins ?? 0) >= boost.cost
          const isActive    = activeIds.has(boost.id)
          const activeEntry = activeBoostList.find((b) => b.id === boost.id)
          const remainingMin = activeEntry
            ? Math.max(0, Math.ceil((activeEntry.expiresAt - nowMs) / 60_000))
            : null

          return (
            <Card
              key={boost.id}
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                border: `1px solid ${isActive ? 'rgba(251,191,36,0.35)' : '#2a2a3e'}`,
                background: isActive ? 'rgba(251,191,36,0.04)' : '#16161f',
              }}
            >
              {/* Info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#e2e2e7' }}>
                    {boost.label}
                  </span>
                  {isActive && <Badge variant="gold">Activo</Badge>}
                </div>

                {/* Countdown */}
                {isActive && remainingMin !== null && (
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                    {remainingMin}m restantes
                  </span>
                )}
                {isActive && remainingMin === null && (
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Aplicado</span>
                )}
              </div>

              {/* Buy button */}
              <Button
                variant={canAfford ? (isActive ? 'ghost-gold' : 'gold') : 'subtle'}
                size="sm"
                disabled={!canAfford}
                onClick={() => handleBuy(boost)}
                type="button"
                style={{ flexShrink: 0 }}
              >
                🪙 {boost.cost}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
