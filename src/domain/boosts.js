/**
 * Boost catalog and helpers for TaskQuest idle farming system.
 *
 * Boost types:
 *  - coinMultiplier boosts: multiply coins earned per idle tick for a duration
 *  - energyCapBonus boosts: add extra capacity to the energy cap for a duration
 *  - instant boosts: applied immediately (energy_refill), no expiresAt
 *
 * All functions are pure (no DB access).
 */

/** Duration constants in milliseconds */
const MIN_30  = 30  * 60 * 1_000
const HOUR_2  = 120 * 60 * 1_000
const HOUR_24 = 24  * 60 * 60 * 1_000

/**
 * Boost catalog.
 *
 * Fields:
 *   id             – stable string identifier
 *   cost           – coins required to buy
 *   label          – display name
 *   durationMs     – duration in milliseconds (undefined for instant boosts)
 *   coinMultiplier – multiplier applied to coin earnings (undefined if not applicable)
 *   energyCapBonus – bonus added to energyCap (undefined if not applicable)
 *   instant        – true for boosts applied immediately without a timer
 */
export const BOOST_CATALOG = [
  {
    id: 'coin_x2_30m',
    cost: 120,
    label: '×2 monedas (30 min)',
    durationMs: MIN_30,
    coinMultiplier: 2,
  },
  {
    id: 'coin_x2_2h',
    cost: 380,
    label: '×2 monedas (2 h)',
    durationMs: HOUR_2,
    coinMultiplier: 2,
  },
  {
    id: 'energy_cap_plus50_24h',
    cost: 250,
    label: '+50 energía máxima (24 h)',
    durationMs: HOUR_24,
    energyCapBonus: 50,
  },
  {
    id: 'energy_refill',
    cost: 90,
    label: 'Rellenar energía al máximo',
    instant: true,
  },
]

/**
 * Returns a boost definition by id, or undefined.
 * @param {string} id
 */
export function getBoost(id) {
  return BOOST_CATALOG.find((b) => b.id === id)
}

/**
 * Filters the stored boosts array to only those still active at `now`.
 * Instant boosts (no expiresAt) are never stored in the active list after application.
 *
 * @param {Array<{ id: string, expiresAt: number }>} boosts – stored active boosts
 * @param {number} now – current timestamp in ms
 * @returns {Array}
 */
export function getActiveBoosts(boosts, now) {
  if (!boosts || boosts.length === 0) return []
  return boosts.filter((b) => b.expiresAt != null && b.expiresAt > now)
}

/**
 * Computes the effective energyCap after applying active energyCapBonus boosts.
 *
 * @param {number} baseCap     – the base energyCap stored on the player
 * @param {Array}  activeBoosts – active boosts (from getActiveBoosts)
 * @returns {number}
 */
export function applyBoostsToCaps(baseCap, activeBoosts) {
  if (!activeBoosts || activeBoosts.length === 0) return baseCap
  const bonus = activeBoosts.reduce((sum, b) => sum + (b.energyCapBonus ?? 0), 0)
  return baseCap + bonus
}
