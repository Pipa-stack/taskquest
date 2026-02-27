/**
 * Zone catalog and helpers for TaskQuest's meta-game progression.
 *
 * 6 zones with increasing power requirements and coin costs.
 * Zones must be unlocked sequentially (zone N requires zone N-1 to be unlocked).
 * Zone 1 is always unlocked by default.
 *
 * Each zone grants a permanent coinsPerMinuteBonus when unlocked.
 *
 * Economy numbers (costs, power requirements) are sourced from ZONE_ECONOMY in
 * src/domain/config.js — edit there for balance adjustments.
 */

import { ZONE_ECONOMY } from './config.js'

const _e = ZONE_ECONOMY

export const ZONE_CATALOG = [
  {
    id: 1,
    name: 'Bosque Inicial',
    emoji: '🌲',
    themeColor: '#4ade80',
    requiredPower: _e[1].requiredPower,
    unlockCostCoins: _e[1].unlockCostCoins,
    coinsPerMinuteBonus: _e[1].coinsPerMinuteBonus,
    packReward: null,
  },
  {
    id: 2,
    name: 'Cavernas Oscuras',
    emoji: '⛏️',
    themeColor: '#94a3b8',
    requiredPower: _e[2].requiredPower,
    unlockCostCoins: _e[2].unlockCostCoins,
    coinsPerMinuteBonus: _e[2].coinsPerMinuteBonus,
    packReward: 'starter',
  },
  {
    id: 3,
    name: 'Fortaleza de Piedra',
    emoji: '🏰',
    themeColor: '#f97316',
    requiredPower: _e[3].requiredPower,
    unlockCostCoins: _e[3].unlockCostCoins,
    coinsPerMinuteBonus: _e[3].coinsPerMinuteBonus,
    packReward: 'starter',
  },
  {
    id: 4,
    name: 'Torre Arcana',
    emoji: '🔮',
    themeColor: '#a78bfa',
    requiredPower: _e[4].requiredPower,
    unlockCostCoins: _e[4].unlockCostCoins,
    coinsPerMinuteBonus: _e[4].coinsPerMinuteBonus,
    packReward: 'boost',
  },
  {
    id: 5,
    name: 'Abismo Eterno',
    emoji: '💀',
    themeColor: '#ef4444',
    requiredPower: _e[5].requiredPower,
    unlockCostCoins: _e[5].unlockCostCoins,
    coinsPerMinuteBonus: _e[5].coinsPerMinuteBonus,
    packReward: 'boost',
  },
  {
    id: 6,
    name: 'Cima del Mundo',
    emoji: '⭐',
    themeColor: '#fbbf24',
    requiredPower: _e[6].requiredPower,
    unlockCostCoins: _e[6].unlockCostCoins,
    coinsPerMinuteBonus: _e[6].coinsPerMinuteBonus,
    packReward: 'mega',
  },
]

/** Returns a zone definition by id, or undefined. */
export function getZone(zoneId) {
  return ZONE_CATALOG.find((z) => z.id === zoneId)
}

/**
 * Pure guard: can the player unlock the given zone?
 *
 * Rules:
 *  - Zone must exist in ZONE_CATALOG.
 *  - Zone must be exactly one step ahead of the current max (sequential unlock).
 *  - Player's power score must meet the zone's requiredPower.
 *  - Player must have enough coins.
 *
 * @param {object} player     – player record (zoneUnlockedMax, coins)
 * @param {number} powerScore – pre-computed power score
 * @param {number} zoneId     – target zone id
 * @returns {boolean}
 */
export function canUnlockZone(player, powerScore, zoneId) {
  const zone = getZone(zoneId)
  if (!zone) return false

  const maxUnlocked = player.zoneUnlockedMax ?? 1

  // Already unlocked
  if (zoneId <= maxUnlocked) return false

  // Must unlock sequentially
  if (zoneId !== maxUnlocked + 1) return false

  // Power check
  if (powerScore < zone.requiredPower) return false

  // Coins check
  if ((player.coins ?? 0) < zone.unlockCostCoins) return false

  return true
}

/**
 * Pure mutation: returns an updated player object after unlocking a zone.
 * Deducts coins, increases zoneUnlockedMax, sets currentZone, and increases
 * coinsPerMinuteBase by the zone's bonus.
 *
 * Does NOT validate — callers must use canUnlockZone first.
 *
 * @param {object} player  – player record
 * @param {number} zoneId  – zone to unlock
 * @returns {object} updated player snapshot (pure, no mutation)
 */
export function applyZoneUnlock(player, zoneId) {
  const zone = getZone(zoneId)
  return {
    ...player,
    coins: Math.max(0, (player.coins ?? 0) - zone.unlockCostCoins),
    zoneUnlockedMax: Math.max(player.zoneUnlockedMax ?? 1, zoneId),
    currentZone: zoneId,
    coinsPerMinuteBase: (player.coinsPerMinuteBase ?? 1) + zone.coinsPerMinuteBonus,
  }
}
