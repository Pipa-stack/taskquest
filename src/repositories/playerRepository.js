import db from '../db/db.js'
import { getCharacter } from '../domain/characters.js'
import { getStage, canEvolve, evolveCost } from '../domain/evolution.js'

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
    coins: player.coins ?? 0,
    unlockedCharacters: player.unlockedCharacters ?? [],
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
   * Spends XP to unlock a reward and enqueues a UPSERT_PLAYER outbox entry.
   * Validates that the player has sufficient XP and hasn't already unlocked the reward.
   * Runs in a single atomic transaction.
   *
   * @param {{ rewardId: string, costXP: number }} params
   * @returns {Promise<boolean>} true if the reward was unlocked, false if conditions not met
   */
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

  /**
   * Adds coins to the player's balance (never negative).
   * Runs in a single atomic transaction.
   *
   * @param {number} amount - Coins to add (must be >= 0)
   */
  async addCoins(amount) {
    if (amount <= 0) return
    const now = new Date().toISOString()
    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0, coins: 0 }
      const updated = {
        ...player,
        id: 1,
        coins: (player.coins ?? 0) + amount,
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
   * Spends coins from the player's balance.
   * Does nothing and returns false if balance is insufficient.
   * Must be called inside an existing transaction when composing with unlockCharacter.
   *
   * @param {number} amount - Coins to spend (must be > 0)
   * @param {object} player - Current player record (already fetched within the transaction)
   * @returns {{ ok: boolean, updatedPlayer: object|null }}
   */
  _spendCoinsInTx(amount, player) {
    if ((player.coins ?? 0) < amount) return { ok: false, updatedPlayer: null }
    const updatedPlayer = {
      ...player,
      id: 1,
      coins: Math.max(0, (player.coins ?? 0) - amount),
    }
    return { ok: true, updatedPlayer }
  },

  /**
   * Purchases a character from the catalog:
   *   1. Validates the character exists in the catalog.
   *   2. If already owned → no-op (returns false).
   *   3. If insufficient coins → returns false.
   *   4. Otherwise: deducts coins, adds character to unlockedCharacters, enqueues sync.
   * All writes happen in a single atomic transaction.
   *
   * @param {string} characterId
   * @returns {Promise<boolean>} true if purchase succeeded
   */
  async buyCharacter(characterId) {
    const character = getCharacter(characterId)
    if (!character) return false

    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        unlockedCharacters: [],
      }

      const already = (player.unlockedCharacters ?? []).includes(characterId)
      if (already) return

      const { ok, updatedPlayer } = playerRepository._spendCoinsInTx(
        character.priceCoins,
        player
      )
      if (!ok) return

      const finalPlayer = {
        ...updatedPlayer,
        unlockedCharacters: [...(player.unlockedCharacters ?? []), characterId],
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(finalPlayer)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(finalPlayer),
        retryCount: 0,
      })
      success = true
    })

    return success
  },

  /**
   * Evolves a character to the next stage (1→2 or 2→3).
   *
   * Guards (all checked atomically inside the transaction):
   *   1. Character must exist in the catalog.
   *   2. Character must be unlocked (in unlockedCharacters).
   *   3. Character must be able to evolve (stage < 3).
   *   4. Player must have enough coins.
   *
   * Idempotent: calling evolveCharacter on a Stage 3 character returns false without
   * modifying any state.
   *
   * @param {string} characterId
   * @returns {Promise<boolean>} true if evolution succeeded
   */
  async evolveCharacter(characterId) {
    const character = getCharacter(characterId)
    if (!character) return false

    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        unlockedCharacters: [],
        characterStages: {},
      }

      // Guard: must be unlocked
      const isUnlocked = (player.unlockedCharacters ?? []).includes(characterId)
      if (!isUnlocked) return

      // Guard: must have evolution remaining
      if (!canEvolve(characterId, player)) return

      // Guard: must have enough coins
      const cost = evolveCost(characterId, character.rarity, player)
      if (cost === null) return

      const { ok, updatedPlayer } = playerRepository._spendCoinsInTx(cost, player)
      if (!ok) return

      const nextStage = getStage(characterId, player) + 1
      const finalPlayer = {
        ...updatedPlayer,
        characterStages: {
          ...(player.characterStages ?? {}),
          [characterId]: nextStage,
        },
        updatedAt: now,
        syncStatus: 'pending',
      }
      await db.players.put(finalPlayer)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(finalPlayer),
        retryCount: 0,
      })
      success = true
    })

    return success
  },
}
