/**
 * Boost catalog and helpers for TaskQuest idle farming system.
 *
 * Boost types:
 *  - coinMultiplier boosts: multiply coins earned per idle tick for a duration
 *  - energyCapBonus boosts: add extra capacity to the energy cap for a duration
 *  - instant boosts: applied immediately (energy_refill), no expiresAt
 *
 * All functions are pure (no DB access).
 *
 * Costs are defined in src/domain/config.js (BOOST_CFG) — edit there for balance.
 */

import { BOOST_CFG } from './config.js'

export const BOOST_CATALOG = [
  {
    id: 'coin_x2_30m',
    cost: BOOST_CFG.coin_x2_30m.cost,
    label: '×2 monedas (30 min)',
    durationMs: BOOST_CFG.coin_x2_30m.durationMs,
    coinMultiplier: BOOST_CFG.coin_x2_30m.coinMultiplier,
  },
  {
    id: 'coin_x2_2h',
    cost: BOOST_CFG.coin_x2_2h.cost,
    label: '×2 monedas (2 h)',
    durationMs: BOOST_CFG.coin_x2_2h.durationMs,
    coinMultiplier: BOOST_CFG.coin_x2_2h.coinMultiplier,
  },
  {
    id: 'energy_cap_plus50_24h',
    cost: BOOST_CFG.energy_cap_plus50_24h.cost,
    label: '+50 energía máxima (24 h)',
    durationMs: BOOST_CFG.energy_cap_plus50_24h.durationMs,
    energyCapBonus: BOOST_CFG.energy_cap_plus50_24h.energyCapBonus,
  },
  {
    id: 'energy_refill',
    cost: BOOST_CFG.energy_refill.cost,
    label: 'Rellenar energía al máximo',
    instant: BOOST_CFG.energy_refill.instant,
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
