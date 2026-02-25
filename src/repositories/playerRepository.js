import db from '../db/db.js'

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
    updatedAt: player.updatedAt,
  }
}

/**
 * Low-level player repository. Handles Dexie reads/writes for the player record.
 * All mutations also enqueue a UPSERT_PLAYER outbox entry for remote sync.
 *
 * Source of truth is always Dexie (offline-first). Sync is eventual via the
 * outbox pattern — UI is never blocked waiting for the network.
 *
 * PR11 will extend this with character-related mutations once the
 * unlocked_characters field is added to player_state.
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
}
