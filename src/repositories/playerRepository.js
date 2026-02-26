import db from '../db/db.js'
import { getCharacter, getEvolutionCost } from '../domain/characters.js'

/**
 * Builds the minimal player snapshot to store in the outbox payload.
 * Only includes fields that are synced to the remote player_state table.
 * Local-only fields (combo, lastCompleteAt, achievementsUnlocked) are excluded.
 */
export function playerToPayload(player) {
  return {
    xp: player.xp ?? 0,
    streak: player.streak ?? 0,
    lastActiveDate: player.lastActiveDate ?? null,
    dailyGoal: player.dailyGoal ?? 3,
    rewardsUnlocked: player.rewardsUnlocked ?? [],
    unlockedCharacters: player.unlockedCharacters ?? [],
    activeTeam: player.activeTeam ?? [],
    coins: player.coins ?? 0,
    characterStages: player.characterStages ?? {},
    updatedAt: player.updatedAt,
  }
}

/**
 * Low-level player repository. Handles Dexie reads/writes for the player record.
 * All mutations also enqueue a UPSERT_PLAYER outbox entry for remote sync.
 *
 * Source of truth is always Dexie (offline-first). Sync is eventual via the
 * outbox pattern — UI is never blocked waiting for the network.
 */
export const playerRepository = {
  /**
   * Enqueues a UPSERT_PLAYER outbox entry for an already-written player.
   * Designed to be called INSIDE an existing Dexie transaction that includes db.outbox.
   *
   * @param {object} player - The player object already saved to db.players
   * @param {string} nowISO - ISO timestamp (used as createdAt for ordering)
   */
  async enqueueUpsert(player, nowISO) {
    await db.outbox.add({
      createdAt: nowISO,
      status: 'pending',
      type: 'UPSERT_PLAYER',
      payload: playerToPayload(player),
      retryCount: 0,
    })
  },

  /**
   * Updates the player's dailyGoal and enqueues a UPSERT_PLAYER outbox entry.
   * Runs in a single atomic transaction.
   *
   * @param {number} newGoal - The new daily goal value (1–10)
   */
  async setDailyGoal(newGoal) {
    const now = new Date().toISOString()
    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0 }
      const updated = {
        ...player,
        id: 1,
        dailyGoal: newGoal,
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
    })
  },

  /**
   * Purchases a character with coins and enqueues a UPSERT_PLAYER outbox entry.
   * Validates: character exists in catalog, not already purchased, coins sufficient.
   * Runs in a single atomic transaction.
   *
   * @param {string} characterId
   * @returns {Promise<boolean>} true if purchased, false if conditions not met
   */
  async buyCharacter(characterId) {
    const char = getCharacter(characterId)
    if (!char) return false

    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        unlockedCharacters: [],
      }
      const alreadyUnlocked = (player.unlockedCharacters ?? []).includes(characterId)
      const coins = player.coins ?? 0
      if (alreadyUnlocked || coins < char.priceCoins) return

      const updated = {
        ...player,
        id: 1,
        coins: Math.max(0, coins - char.priceCoins),
        unlockedCharacters: [...(player.unlockedCharacters ?? []), characterId],
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
      success = true
    })

    return success
  },

  /**
   * Evolves a character from Stage I to Stage II by spending coins.
   * Validates: character exists, is unlocked, not already at max stage, coins sufficient.
   * Evolution cost depends on character rarity (see EVOLUTION_COSTS).
   * Runs in a single atomic transaction.
   *
   * @param {string} characterId
   * @returns {Promise<boolean>} true if evolved, false if conditions not met
   */
  async evolveCharacter(characterId) {
    const char = getCharacter(characterId)
    if (!char) return false

    const evolutionCost = getEvolutionCost(characterId)
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        coins: 0,
        unlockedCharacters: [],
        characterStages: {},
      }
      const unlocked = player.unlockedCharacters ?? []
      if (!unlocked.includes(characterId)) return

      const stages = player.characterStages ?? {}
      const currentStage = stages[characterId] ?? 1
      if (currentStage >= 2) return // already at max stage

      const coins = player.coins ?? 0
      if (coins < evolutionCost) return

      const updated = {
        ...player,
        id: 1,
        coins: Math.max(0, coins - evolutionCost),
        characterStages: { ...stages, [characterId]: currentStage + 1 },
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
      success = true
    })

    return success
  },

  /**
   * Replaces the active team with the given array of character ids.
   * Validates: array, max 3 items, all ids must be in unlockedCharacters.
   * Idempotent: saving the same team again is a no-op in effect but still persists.
   *
   * @param {string[]} teamIds
   * @returns {Promise<boolean>} true on success, false if validation fails
   */
  async setActiveTeam(teamIds) {
    if (!Array.isArray(teamIds)) return false
    if (teamIds.length > 3) return false

    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0, unlockedCharacters: [] }
      const unlocked = player.unlockedCharacters ?? []
      if (teamIds.some((id) => !unlocked.includes(id))) return

      const updated = {
        ...player,
        id: 1,
        activeTeam: teamIds,
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
      success = true
    })

    return success
  },

  /**
   * Adds a character to the active team if not already present and there is room.
   * - If already in team → no-op, returns true (idempotent).
   * - If team is full (3) → returns false.
   * - If character not unlocked → returns false.
   *
   * @param {string} characterId
   * @returns {Promise<boolean>}
   */
  async addToTeam(characterId) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0, unlockedCharacters: [], activeTeam: [] }
      const unlocked = player.unlockedCharacters ?? []
      const team = player.activeTeam ?? []

      if (!unlocked.includes(characterId)) return
      if (team.includes(characterId)) { success = true; return }
      if (team.length >= 3) return

      const updated = {
        ...player,
        id: 1,
        activeTeam: [...team, characterId],
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
      success = true
    })

    return success
  },

  /**
   * Removes a character from the active team.
   * If not in team → no-op, returns true (idempotent).
   *
   * @param {string} characterId
   * @returns {Promise<boolean>}
   */
  async removeFromTeam(characterId) {
    const now = new Date().toISOString()

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0, activeTeam: [] }
      const team = player.activeTeam ?? []
      if (!team.includes(characterId)) return

      const updated = {
        ...player,
        id: 1,
        activeTeam: team.filter((id) => id !== characterId),
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
    })

    return true
  },

  async spendXpOnReward({ rewardId, costXP }) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        rewardsUnlocked: [],
      }
      const alreadyUnlocked = (player.rewardsUnlocked ?? []).includes(rewardId)
      // Guard: player must have enough XP and not already own the reward
      if (alreadyUnlocked || player.xp < costXP) return

      const updated = {
        ...player,
        id: 1,
        // Math.max(0, ...) is a safety guard — the check above already prevents negatives
        xp: Math.max(0, player.xp - costXP),
        rewardsUnlocked: [...(player.rewardsUnlocked ?? []), rewardId],
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
      success = true
    })

    return success
  },
}
