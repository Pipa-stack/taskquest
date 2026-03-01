import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card, Badge, Button, Chip, StatRow } from '../ui/index.js'
import PackOpeningModal from './PackOpeningModal.jsx'
import { BASE_RATES, applyGachaRareBonus, computeEffectivePity } from '../domain/gacha.js'
import { computeTalentBonuses } from '../domain/talents.js'

/** Pull-rate display name + badge variant per rarity */
const RARITY_META = {
  common:    { label: 'Común',      variant: 'neutral' },
  uncommon:  { label: 'Poco común', variant: 'green'   },
  rare:      { label: 'Raro',       variant: 'blue'    },
  epic:      { label: 'Épico',      variant: 'purple'  },
  legendary: { label: 'Legendario', variant: 'gold'    },
}

/** Pack catalog — display-only (no cost persistence yet; uses coins from player). */
const PACK_CATALOG = [
  {
    id: 'basic',
    name: 'Pack Básico',
    emoji: '📦',
    cost: 500,
    pulls: 1,
    description: '1 tirada · Probabilidad estándar',
    featured: false,
  },
  {
    id: 'premium',
    name: 'Pack Premium',
    emoji: '💎',
    cost: 2000,
    pulls: 10,
    description: '10 tiradas · Garantía de Raro+',
    featured: true,
  },
]

/** Weighted random rarity draw from effectiveRates. */
function pullRarity(rates) {
  const roll = Math.random()
  let cumulative = 0
  for (const [rarity, rate] of Object.entries(rates)) {
    cumulative += rate
    if (roll < cumulative) return rarity
  }
  return 'common'
}

/**
 * GachaShop — showcase screen for the gacha summoning system.
 *
 * Props:
 *  coins   {number}   – current coin balance
 *  talents {object}   – player talents {idle, gacha, power}
 *  onNotify{Function} – toast callback
 */
export default function GachaShop({ coins = 0, talents, onNotify }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPack, setPendingPack] = useState(null)
  const [results, setResults]   = useState([])
  const reduced = useReducedMotion()

  const talentBonuses  = computeTalentBonuses(talents ?? {})
  const effectiveRates = applyGachaRareBonus(BASE_RATES, talentBonuses.gachaRareBonus)
  const pity           = computeEffectivePity(talentBonuses.pityReduction)

  const handlePull = (pack) => {
    if (coins < pack.cost) {
      onNotify?.('Monedas insuficientes para este pack')
      return
    }
    const pullResults = Array.from({ length: pack.pulls }, (_, i) => ({
      rarity: pullRarity(effectiveRates),
      id: `${Date.now()}-${i}`,
    }))
    setResults(pullResults)
    setPendingPack(pack)
    setModalOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#e2e2e7', margin: 0 }}>
          🎲 Tienda Gacha
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#5a5a7a', marginTop: '0.25rem' }}>
          Invoca personajes con monedas · sistema de piedad activado
        </p>
      </div>

      {/* ── Balance ────────────────────────────────────────── */}
      <StatRow
        icon="🪙"
        label="Monedas disponibles"
        value={coins.toLocaleString('es')}
        valueColor="#fbbf24"
      />

      {/* ── Rates ──────────────────────────────────────────── */}
      <Card style={{ padding: '1rem 1.25rem' }}>
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#5a5a7a',
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          Tasas de rareza
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {Object.entries(effectiveRates).map(([rarity, rate]) => (
            <Badge key={rarity} variant={RARITY_META[rarity]?.variant ?? 'neutral'}>
              {RARITY_META[rarity]?.label ?? rarity}: {(rate * 100).toFixed(1)}%
            </Badge>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#5a5a7a', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span>Piedad: garantía Raro+ cada <strong style={{ color: '#a78bfa' }}>{pity}</strong> tiradas</span>
          {talentBonuses.pityReduction > 0 && (
            <Badge variant="purple">Talento −{talentBonuses.pityReduction}</Badge>
          )}
          {talentBonuses.gachaRareBonus > 0 && (
            <Badge variant="blue">+{Math.round(talentBonuses.gachaRareBonus * 100)}% tasa rare</Badge>
          )}
        </div>
      </Card>

      {/* ── Pack cards ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {PACK_CATALOG.map((pack) => {
          const canAfford = coins >= pack.cost
          return (
            <motion.div
              key={pack.id}
              whileHover={reduced ? {} : { y: -3 }}
              transition={{ duration: 0.15 }}
              style={{
                background: pack.featured ? '#1a1830' : '#16161f',
                border: `1px solid ${pack.featured ? 'rgba(167,139,250,0.35)' : '#2a2a3e'}`,
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: pack.featured
                  ? '0 0 0 1px rgba(167,139,250,0.1), 0 4px 24px rgba(0,0,0,0.4)'
                  : '0 4px 24px rgba(0,0,0,0.3)',
              }}
            >
              {pack.featured && (
                <div style={{ position: 'absolute', top: '0.65rem', right: '0.65rem' }}>
                  <Badge variant="purple">Destacado</Badge>
                </div>
              )}

              {/* Icon */}
              <span style={{ fontSize: '2.8rem', lineHeight: 1 }}>{pack.emoji}</span>

              {/* Info */}
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#e2e2e7' }}>
                  {pack.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#8a8ab0', marginTop: '0.25rem' }}>
                  {pack.description}
                </div>
              </div>

              {/* Price */}
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24' }}>
                🪙 {pack.cost.toLocaleString('es')}
              </div>

              {/* CTA */}
              <Button
                variant={canAfford ? (pack.featured ? 'primary' : 'ghost') : 'subtle'}
                disabled={!canAfford}
                onClick={() => handlePull(pack)}
                fullWidth
              >
                {canAfford ? `Invocar (${pack.pulls}×)` : 'Sin monedas suficientes'}
              </Button>
            </motion.div>
          )
        })}
      </div>

      {/* ── Pack Opening Modal ──────────────────────────────── */}
      <PackOpeningModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        results={results}
        pack={pendingPack}
      />
    </div>
  )
}
