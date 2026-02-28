/**
 * repairService.js
 *
 * Data repair utilities for the local Dexie database.
 * Fixes NaN/Infinity/negative values, oversized arrays, and missing defaults.
 * NEVER deletes valid progress — only corrects clearly invalid data.
 *
 * Design: changes are only reported for values that EXIST and are invalid.
 * Missing/undefined fields are silently filled with defaults.
 */

import db from '../db/db.js'

// ─── Array size caps ──────────────────────────────────────────────────────────
export const CAP_UNLOCKED_CHARACTERS = 500
export const CAP_GACHA_HISTORY = 50
export const CAP_OUTBOX = 2000

// ─── Safe number helpers ──────────────────────────────────────────────────────

/**
 * Returns true if value is a defined (non-undefined, non-null) number
 * that is NaN or infinite.
 */
function isInvalidNumber(value) {
  if (value === undefined || value === null) return false
  const n = Number(value)
  return isNaN(n) || !isFinite(n)
}

/**
 * Returns true if value is defined, valid, and less than min.
 */
function isNegative(value) {
  if (value === undefined || value === null) return false
  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return false
  return n < 0
}

// ─── Player repair ────────────────────────────────────────────────────────────

/**
 * Pure function: repairs a player object without mutating the original.
 *
 * - Only reports changes when a field EXISTS and has an invalid value.
 * - Missing/undefined fields are silently filled with defaults (no change entry).
 * - Fixes NaN/Infinity → defaults; negative numbers → 0 (or 1.0 for combo).
 * - Caps oversized arrays.
 *
 * @param {object} player
 * @returns {{ repaired: object, changes: string[] }} repaired player + change log
 */
export function repairLocalPlayer(player) {
  if (!player || typeof player !== 'object') {
    return {
      repaired: _defaultPlayer(),
      changes: ['player object was missing — created from defaults'],
    }
  }

  const changes = []
  const p = { ..._defaultPlayer(), ...player }

  // ── Numeric fields: clamp NaN/Infinity/negatives ─────────────────────────
  // For each field, only report a change if the ORIGINAL value existed AND was invalid.
  // Missing fields are silently set to defaults (included via _defaultPlayer spread above).
  const numericFields = {
    xp: 0,
    streak: 0,
    dailyGoal: 3,
    coins: 0,
    energy: 100,
    energyCap: 100,
    coinsPerMinuteBase: 1,
    currentZone: 1,
    zoneUnlockedMax: 1,
    powerScoreCache: 0,
    essence: 0,
    essenceSpent: 0,
  }

  for (const [field, def] of Object.entries(numericFields)) {
    const raw = player[field] // original, possibly undefined
    if (raw === undefined || raw === null) {
      // Silently fill with default (no change logged)
      p[field] = def
      continue
    }
    if (isInvalidNumber(raw)) {
      changes.push(`${field}: ${raw} → ${def}`)
      p[field] = def
    } else if (isNegative(raw)) {
      changes.push(`${field}: ${raw} → 0`)
      p[field] = 0
    }
    // If valid and non-negative, keep as-is (already set via spread)
  }

  // combo must be between 1.0 and 1.4
  {
    const rawCombo = player.combo
    if (rawCombo === undefined || rawCombo === null) {
      p.combo = 1.0 // silent default
    } else if (isInvalidNumber(rawCombo)) {
      changes.push(`combo: ${rawCombo} → 1.0`)
      p.combo = 1.0
    } else {
      const clampedCombo = Math.min(1.4, Math.max(1.0, rawCombo))
      if (clampedCombo !== rawCombo) {
        changes.push(`combo: ${rawCombo} → ${clampedCombo}`)
        p.combo = clampedCombo
      }
    }
  }

  // energy must not exceed energyCap
  if (typeof p.energy === 'number' && typeof p.energyCap === 'number') {
    if (p.energy > p.energyCap) {
      changes.push(`energy: ${p.energy} → ${p.energyCap} (capped to energyCap)`)
      p.energy = p.energyCap
    }
  }

  // ── Array fields ─────────────────────────────────────────────────────────
  {
    const raw = player.achievementsUnlocked
    if (raw !== undefined && !Array.isArray(raw)) {
      changes.push('achievementsUnlocked: reset to []')
      p.achievementsUnlocked = []
    } else if (!Array.isArray(p.achievementsUnlocked)) {
      p.achievementsUnlocked = []
    }
  }

  {
    const raw = player.rewardsUnlocked
    if (raw !== undefined && !Array.isArray(raw)) {
      changes.push('rewardsUnlocked: reset to []')
      p.rewardsUnlocked = []
    } else if (!Array.isArray(p.rewardsUnlocked)) {
      p.rewardsUnlocked = []
    }
  }

  {
    const raw = player.activeTeam
    if (raw !== undefined && !Array.isArray(raw)) {
      changes.push('activeTeam: reset to []')
      p.activeTeam = []
    } else if (!Array.isArray(p.activeTeam)) {
      p.activeTeam = []
    } else if (p.activeTeam.length > 3) {
      changes.push(`activeTeam: truncated from ${p.activeTeam.length} to 3`)
      p.activeTeam = p.activeTeam.slice(0, 3)
    }
  }

  {
    const raw = player.boosts
    if (raw !== undefined && !Array.isArray(raw)) {
      changes.push('boosts: reset to []')
      p.boosts = []
    } else if (!Array.isArray(p.boosts)) {
      p.boosts = []
    }
  }

  // unlockedCharacters — cap to 500
  {
    const raw = player.unlockedCharacters
    if (raw !== undefined && !Array.isArray(raw)) {
      changes.push('unlockedCharacters: reset to []')
      p.unlockedCharacters = []
    } else if (!Array.isArray(p.unlockedCharacters)) {
      p.unlockedCharacters = []
    } else if (p.unlockedCharacters.length > CAP_UNLOCKED_CHARACTERS) {
      changes.push(`unlockedCharacters: truncated from ${p.unlockedCharacters.length} to ${CAP_UNLOCKED_CHARACTERS}`)
      p.unlockedCharacters = p.unlockedCharacters.slice(0, CAP_UNLOCKED_CHARACTERS)
    }
  }

  // gachaHistory — cap to 50 (keep most recent = last 50)
  if (Array.isArray(player.gachaHistory) && player.gachaHistory.length > CAP_GACHA_HISTORY) {
    changes.push(`gachaHistory: truncated from ${player.gachaHistory.length} to ${CAP_GACHA_HISTORY} (kept most recent)`)
    p.gachaHistory = player.gachaHistory.slice(-CAP_GACHA_HISTORY)
  }

  // ── Object fields ─────────────────────────────────────────────────────────
  {
    const raw = player.talents
    if (raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) {
      changes.push('talents: reset to defaults')
      p.talents = { idle: 0, gacha: 0, power: 0 }
    } else if (!p.talents || typeof p.talents !== 'object' || Array.isArray(p.talents)) {
      p.talents = { idle: 0, gacha: 0, power: 0 }
    } else {
      for (const branch of ['idle', 'gacha', 'power']) {
        const branchRaw = p.talents[branch]
        if (branchRaw !== undefined && (isInvalidNumber(branchRaw) || isNegative(branchRaw))) {
          changes.push(`talents.${branch}: ${branchRaw} → 0`)
          p.talents = { ...p.talents, [branch]: 0 }
        } else if (branchRaw === undefined) {
          p.talents = { ...p.talents, [branch]: 0 }
        }
      }
    }
  }

  {
    const raw = player.zoneProgress
    if (raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) {
      changes.push('zoneProgress: reset to {}')
      p.zoneProgress = {}
    } else if (!p.zoneProgress || typeof p.zoneProgress !== 'object' || Array.isArray(p.zoneProgress)) {
      p.zoneProgress = {}
    }
  }

  // Ensure id is set
  p.id = 1

  return { repaired: p, changes }
}

/**
 * Returns the minimum valid player defaults (used when no player exists).
 */
function _defaultPlayer() {
  return {
    id: 1,
    xp: 0,
    streak: 0,
    combo: 1.0,
    lastActiveDate: null,
    lastCompleteAt: null,
    dailyGoal: 3,
    achievementsUnlocked: [],
    rewardsUnlocked: [],
    unlockedCharacters: [],
    activeTeam: [],
    syncStatus: null,
    coins: 0,
    energy: 100,
    energyCap: 100,
    lastIdleTickAt: null,
    boosts: [],
    coinsPerMinuteBase: 1,
    currentZone: 1,
    zoneUnlockedMax: 1,
    zoneProgress: {},
    powerScoreCache: 0,
    essence: 0,
    talents: { idle: 0, gacha: 0, power: 0 },
    essenceSpent: 0,
    lastSyncAt: null,
    lastSyncOkAt: null,
    lastSyncErrorAt: null,
    lastSyncErrorMessage: null,
  }
}

// ─── Corruption detection ─────────────────────────────────────────────────────

/**
 * Returns true if the player has clearly invalid data that warrants a
 * user-visible repair banner (not for minor fixable issues).
 *
 * @param {object|null|undefined} player
 * @returns {boolean}
 */
export function hasSevereCorruption(player) {
  if (!player) return false
  if (!isFinite(player.coins) || isNaN(player.coins)) return true
  if (!isFinite(player.xp) || isNaN(player.xp)) return true
  if (typeof player.energy === 'number' && player.energy < 0) return true
  if (player.achievementsUnlocked !== undefined && !Array.isArray(player.achievementsUnlocked)) return true
  return false
}

// ─── Preview helper ───────────────────────────────────────────────────────────

/**
 * Returns a preview of what repairLocalPlayer would change WITHOUT writing.
 *
 * @param {object} player
 * @returns {{ changes: string[], changeCount: number }}
 */
export function previewRepairPlayer(player) {
  const { changes } = repairLocalPlayer(player)
  return { changes, changeCount: changes.length }
}

/**
 * Returns a preview of what repairDb would change WITHOUT writing.
 * Counts outbox items that would be removed.
 *
 * @param {import('dexie').Dexie} [dbInstance]
 * @returns {Promise<{ playerChanges: string[], outboxCorruptCount: number }>}
 */
export async function previewRepairDb(dbInstance = db) {
  const [player, allOutbox] = await Promise.all([
    dbInstance.players.get(1).catch(() => null),
    dbInstance.outbox.toArray().catch(() => []),
  ])

  const { changes: playerChanges } = repairLocalPlayer(player)

  // Count outbox entries that are clearly corrupted
  const outboxCorruptCount = allOutbox.filter((item) => {
    if (!item) return true
    if (typeof item.type !== 'string') return true
    if (!item.payload || typeof item.payload !== 'object') return true
    return false
  }).length

  // Also count outbox items beyond cap (keep most recent)
  const outboxOverCap = Math.max(0, allOutbox.length - CAP_OUTBOX)

  return {
    playerChanges,
    outboxCorruptCount,
    outboxOverCap,
    totalOutbox: allOutbox.length,
  }
}

// ─── Database repair ──────────────────────────────────────────────────────────

/**
 * Runs a safe repair pass on the local database.
 *
 * - Repairs player: fixes NaN/Infinity/negatives, caps arrays, sets defaults.
 * - Cleans outbox: removes clearly corrupted entries (no type/payload).
 * - Truncates outbox to CAP_OUTBOX, keeping most recent entries.
 * - Does NOT delete tasks or valid player progress.
 *
 * @param {import('dexie').Dexie} [dbInstance]
 * @returns {Promise<{ playerChanges: string[], outboxRemoved: number }>}
 */
export async function repairDb(dbInstance = db) {
  let playerChanges = []
  let outboxRemoved = 0

  // ── Repair player ────────────────────────────────────────────────────────
  await dbInstance.transaction('rw', [dbInstance.players], async () => {
    const player = await dbInstance.players.get(1)
    const { repaired, changes } = repairLocalPlayer(player)
    playerChanges = changes
    if (changes.length > 0) {
      await dbInstance.players.put({ ...repaired, id: 1 })
    }
  })

  // ── Clean outbox ─────────────────────────────────────────────────────────
  await dbInstance.transaction('rw', [dbInstance.outbox], async () => {
    const allOutbox = await dbInstance.outbox.orderBy('createdAt').toArray()

    // Identify corrupt entries
    const corruptIds = allOutbox
      .filter((item) => {
        if (!item) return true
        if (typeof item.type !== 'string') return true
        if (!item.payload || typeof item.payload !== 'object') return true
        return false
      })
      .map((item) => item.id)

    await dbInstance.outbox.bulkDelete(corruptIds)
    outboxRemoved += corruptIds.length

    // Truncate to CAP_OUTBOX (keep most recent = highest ids)
    const remaining = allOutbox.filter((item) => !corruptIds.includes(item.id))
    if (remaining.length > CAP_OUTBOX) {
      const toDelete = remaining
        .slice(0, remaining.length - CAP_OUTBOX)
        .map((item) => item.id)
      await dbInstance.outbox.bulkDelete(toDelete)
      outboxRemoved += toDelete.length
    }
  })

  return { playerChanges, outboxRemoved }
}
