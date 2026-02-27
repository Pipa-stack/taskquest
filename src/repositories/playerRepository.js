import db from '../db/db.js'
import { getBoost, getActiveBoosts, applyBoostsToCaps } from '../domain/boosts.js'
import { computeIdleEarnings } from '../domain/idle.js'
import { canUnlockZone, applyZoneUnlock, getZone } from '../domain/zones.js'
import { getQuest } from '../domain/zoneQuests.js'
import { canSpendEssence, applySpendEssence, computeTalentBonuses } from '../domain/talents.js'

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
    updatedAt: player.updatedAt,
    coins: player.coins ?? 0,
    energy: player.energy ?? 100,
    energyCap: player.energyCap ?? 100,
    lastIdleTickAt: player.lastIdleTickAt ?? null,
    boosts: player.boosts ?? [],
    coinsPerMinuteBase: player.coinsPerMinuteBase ?? 1,
    currentZone: player.currentZone ?? 1,
    zoneUnlockedMax: player.zoneUnlockedMax ?? 1,
    zoneProgress: player.zoneProgress ?? {},
    powerScoreCache: player.powerScoreCache ?? 0,
    // Talent tree fields (PR21)
    essence:      player.essence      ?? 0,
    talents:      player.talents      ?? { idle: 0, gacha: 0, power: 0 },
    essenceSpent: player.essenceSpent ?? 0,
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
  /**
   * Spends XP to unlock a character and enqueues a UPSERT_PLAYER outbox entry.
   * Validates that the player has sufficient XP and hasn't already unlocked the character.
   * Runs in a single atomic transaction.
   *
   * @param {{ characterId: string, costXP: number }} params
   * @returns {Promise<boolean>} true if unlocked, false if conditions not met
   */
  async spendXpOnCharacter({ characterId, costXP }) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        unlockedCharacters: [],
      }
      const alreadyUnlocked = (player.unlockedCharacters ?? []).includes(characterId)
      if (alreadyUnlocked || player.xp < costXP) return

      const updated = {
        ...player,
        id: 1,
        xp: Math.max(0, player.xp - costXP),
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

  /**
   * Processes one idle tick: computes earnings since last tick, adds coins,
   * decreases energy, and updates lastIdleTickAt. Enqueues UPSERT_PLAYER.
   *
   * - Uses computeIdleEarnings for the math (pure domain function).
   * - Active boosts are filtered before passing to computeIdleEarnings.
   * - A team multiplier of 1.0 is used here; callers can pre-compute it
   *   using calcTeamMultiplier and pass it via the `multiplier` field on player
   *   if desired — but for simplicity the repository uses 1.0 as default.
   *   The actual team multiplier is computed in the UI layer and can be passed
   *   as an optional param.
   *
   * @param {number} nowMs – current timestamp in milliseconds (e.g. Date.now())
   * @param {number} [teamMultiplier=1] – pre-computed team multiplier
   * @returns {Promise<{ coinsEarned: number, minutesUsed: number }>}
   */
  async tickIdle(nowMs, teamMultiplier = 1) {
    const nowISO = new Date(nowMs).toISOString()
    let result = { coinsEarned: 0, minutesUsed: 0 }

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        energy: 100,
        energyCap: 100,
        lastIdleTickAt: null,
        boosts: [],
        coinsPerMinuteBase: 1,
      }

      const storedBoosts = player.boosts ?? []
      const activeBoosts = getActiveBoosts(storedBoosts, nowMs)

      // Apply talent bonuses on top of base caps and multipliers
      const talentBonuses = computeTalentBonuses(player.talents ?? {})
      const effectiveEnergyCap = applyBoostsToCaps(
        (player.energyCap ?? 100) + talentBonuses.energyCapBonus,
        activeBoosts,
      )
      const effectiveMultiplier =
        teamMultiplier * talentBonuses.idleCoinMult * (player.globalMultiplierCache ?? 1)

      const earnings = computeIdleEarnings({
        now: nowMs,
        lastTickAt: player.lastIdleTickAt != null ? new Date(player.lastIdleTickAt).getTime() : null,
        energy: player.energy ?? 100,
        energyCap: effectiveEnergyCap,
        baseCpm: player.coinsPerMinuteBase ?? 1,
        multiplier: effectiveMultiplier,
        activeBoosts,
        energyRegenPerMin: talentBonuses.energyRegenPerMin ?? 0,
      })

      result = { coinsEarned: earnings.coinsEarned, minutesUsed: earnings.minutesUsed }

      const updated = {
        ...player,
        id: 1,
        coins: Math.max(0, (player.coins ?? 0) + earnings.coinsEarned),
        energy: earnings.newEnergy,
        // Prune expired boosts to keep the array tidy
        boosts: activeBoosts,
        lastIdleTickAt: new Date(earnings.newLastTickAt).toISOString(),
        updatedAt: nowISO,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: nowISO,
        status: 'pending',
        type: 'UPSERT_PLAYER',
        payload: playerToPayload(updated),
        retryCount: 0,
      })
    })

    return result
  },

  /**
   * Purchases a boost and applies it to the player.
   *
   * - Validates that the player has enough coins.
   * - For timed boosts: creates an entry in player.boosts with expiresAt.
   *   Cap boosts (energyCapBonus) are deduplicated: buying again extends the timer.
   * - For instant boosts (energy_refill): immediately sets energy = energyCap.
   * - Enqueues UPSERT_PLAYER outbox entry.
   *
   * @param {string} boostId – id from BOOST_CATALOG
   * @param {number} nowMs   – current timestamp in milliseconds
   * @returns {Promise<boolean>} true on success, false if insufficient coins or unknown boost
   */
  async buyBoost(boostId, nowMs) {
    const boostDef = getBoost(boostId)
    if (!boostDef) return false

    const nowISO = new Date(nowMs).toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        energy: 100,
        energyCap: 100,
        boosts: [],
        coinsPerMinuteBase: 1,
      }

      const currentCoins = player.coins ?? 0
      if (currentCoins < boostDef.cost) return

      let newBoosts = [...(player.boosts ?? [])]
      let newEnergy = player.energy ?? 100
      const newEnergyCap = player.energyCap ?? 100

      if (boostDef.instant) {
        // energy_refill: fill up to the effective cap (including active bonuses)
        const activeBoosts = getActiveBoosts(newBoosts, nowMs)
        const effectiveCap = applyBoostsToCaps(newEnergyCap, activeBoosts)
        newEnergy = effectiveCap
      } else {
        // Apply boostDurationMult from talent bonuses to extend boost duration
        const talentBonuses = computeTalentBonuses(player.talents ?? {})
        const durationMs = Math.floor(boostDef.durationMs * talentBonuses.boostDurationMult)
        const expiresAt = nowMs + durationMs
        // Deduplicate: remove any existing entry for same boost id before adding
        newBoosts = newBoosts.filter((b) => b.id !== boostId)
        newBoosts.push({
          id: boostId,
          expiresAt,
          ...(boostDef.coinMultiplier != null && { coinMultiplier: boostDef.coinMultiplier }),
          ...(boostDef.energyCapBonus != null && { energyCapBonus: boostDef.energyCapBonus }),
        })
      }

      const updated = {
        ...player,
        id: 1,
        coins: Math.max(0, currentCoins - boostDef.cost),
        energy: newEnergy,
        boosts: newBoosts,
        updatedAt: nowISO,
        syncStatus: 'pending',
      }
      await db.players.put(updated)
      await db.outbox.add({
        createdAt: nowISO,
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
   * Changes the player's current zone (must already be unlocked).
   *
   * @param {number} zoneId – target zone id (must be <= zoneUnlockedMax)
   * @returns {Promise<boolean>} true on success
   */
  async setCurrentZone(zoneId) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? { id: 1, xp: 0, zoneUnlockedMax: 1, currentZone: 1 }
      const maxUnlocked = player.zoneUnlockedMax ?? 1

      // Can only enter an already-unlocked zone
      if (!getZone(zoneId)) return
      if (zoneId > maxUnlocked) return

      const updated = {
        ...player,
        id: 1,
        currentZone: zoneId,
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
   * Unlocks the next zone if power and coin requirements are met.
   * Deducts coins, increases zoneUnlockedMax, sets currentZone, and
   * increases coinsPerMinuteBase by the zone's bonus.
   *
   * @param {number} zoneId     – zone to unlock (must be zoneUnlockedMax + 1)
   * @param {number} powerScore – pre-computed power score from computePowerScore
   * @returns {Promise<boolean>} true on success, false if conditions not met
   */
  async unlockZone(zoneId, powerScore) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        zoneUnlockedMax: 1,
        currentZone: 1,
        coinsPerMinuteBase: 1,
        zoneProgress: {},
      }

      if (!canUnlockZone(player, powerScore, zoneId)) return

      const unlocked = applyZoneUnlock(player, zoneId)
      const updated = {
        ...unlocked,
        id: 1,
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
   * Claims the reward for a completed zone quest.
   * Validates that the quest exists, applies the reward (coins), and records
   * the quest as claimed in zoneProgress to prevent double-claiming.
   *
   * The caller is responsible for validating that the quest is actually
   * completed before calling this method.
   *
   * @param {number} zoneId  – zone id
   * @param {string} questId – quest id
   * @returns {Promise<{ coins: number }|false>} reward object or false if already claimed / invalid
   */
  /**
   * Spends essence to buy one talent point in the given branch.
   *
   * Validates that:
   *   - The branch is valid ('idle' | 'gacha' | 'power')
   *   - The player has enough essence
   *   - The branch hasn't reached TALENT_MAX
   *
   * On success: decrements essence, increments talent level, accumulates essenceSpent,
   *             and enqueues a UPSERT_PLAYER outbox entry.
   *
   * @param {'idle'|'gacha'|'power'} branch
   * @returns {Promise<boolean>} true on success, false if conditions not met
   */
  async spendEssenceOnTalent(branch) {
    const now = new Date().toISOString()
    let success = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        essence: 0,
        talents: { idle: 0, gacha: 0, power: 0 },
        essenceSpent: 0,
      }

      if (!canSpendEssence(player, branch)) return

      const applied = applySpendEssence(player, branch)
      const updated = {
        ...applied,
        id: 1,
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

  async claimZoneQuest(zoneId, questId) {
    const quest = getQuest(questId)
    if (!quest) return false

    const now = new Date().toISOString()
    let reward = false

    await db.transaction('rw', [db.players, db.outbox], async () => {
      const player = (await db.players.get(1)) ?? {
        id: 1,
        xp: 0,
        coins: 0,
        zoneProgress: {},
      }

      const zoneData = (player.zoneProgress ?? {})[zoneId] ?? { claimedRewards: [] }
      const alreadyClaimed = (zoneData.claimedRewards ?? []).includes(questId)
      if (alreadyClaimed) return

      const newZoneProgress = {
        ...(player.zoneProgress ?? {}),
        [zoneId]: {
          ...zoneData,
          claimedRewards: [...(zoneData.claimedRewards ?? []), questId],
        },
      }

      const rewardCoins = quest.reward?.coins ?? 0
      const updated = {
        ...player,
        id: 1,
        coins: Math.max(0, (player.coins ?? 0) + rewardCoins),
        zoneProgress: newZoneProgress,
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
      reward = { ...quest.reward }
    })

    return reward
  },
}
