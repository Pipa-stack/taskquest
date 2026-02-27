import db from '../db/db.js'
import { clampPlayer } from '../domain/config.js'

const PLAYER_LAST_PULLED_KEY = 'taskquest.playerLastPulledAt'
const PUSH_BATCH_SIZE = 10

/**
 * Pure helper: decides whether a remote player_state should overwrite the local one.
 * Exported for unit testing.
 *
 * @param {object|null|undefined} local  – local player record (has `updatedAt` field)
 * @param {object} remote               – remote player_state row (has `updated_at` field)
 * @returns {boolean}
 */
export function shouldOverwritePlayer(local, remote) {
  if (!local?.updatedAt) return true
  return remote.updated_at > local.updatedAt
}

/**
 * Pushes pending UPSERT_PLAYER outbox entries to Supabase player_state.
 * Processes up to PUSH_BATCH_SIZE items ordered by createdAt.
 *
 * Remote table: player_state (1 row per user, upserted by user_id)
 * Synced fields: xp, streak, last_active_date, daily_goal, unlocked_rewards,
 *                unlocked_characters (empty until PR11), updated_at
 *
 * On success: marks outbox item 'sent', marks player.syncStatus='synced'.
 * On failure: marks outbox item 'failed', increments retryCount, sets player.syncStatus='error'.
 *
 * @param {{ supabase: object, userId: string }} params
 */
export async function pushPlayerOutbox({ supabase, userId }) {
  if (!supabase || !userId) return

  const allPending = await db.outbox
    .where('status')
    .equals('pending')
    .filter((item) => item.type === 'UPSERT_PLAYER')
    .sortBy('createdAt')

  const batch = allPending.slice(0, PUSH_BATCH_SIZE)

  for (const item of batch) {
    try {
      const p = item.payload

      const remotePlayer = {
        user_id: userId,
        xp: p.xp ?? 0,
        streak: p.streak ?? 0,
        last_active_date: p.lastActiveDate ?? null,
        daily_goal: p.dailyGoal ?? 3,
        unlocked_rewards: p.rewardsUnlocked ?? [],
        unlocked_characters: p.unlockedCharacters ?? [],
        active_team: p.activeTeam ?? [],
        updated_at: p.updatedAt,
        coins: p.coins ?? 0,
        energy: p.energy ?? 100,
        energy_cap: p.energyCap ?? 100,
        last_idle_tick_at: p.lastIdleTickAt ?? null,
        boosts: p.boosts ?? [],
        coins_per_minute_base: p.coinsPerMinuteBase ?? 1,
        current_zone: p.currentZone ?? 1,
        zone_unlocked_max: p.zoneUnlockedMax ?? 1,
        zone_progress: p.zoneProgress ?? {},
        power_score_cache: p.powerScoreCache ?? 0,
        // Talent tree fields (PR21)
        essence:      p.essence      ?? 0,
        talents:      p.talents      ?? {},
        essence_spent: p.essenceSpent ?? 0,
      }

      const { error } = await supabase
        .from('player_state')
        .upsert(remotePlayer, { onConflict: 'user_id' })

      if (error) throw error

      await db.outbox.update(item.id, { status: 'sent' })
      await db.players.update(1, { syncStatus: 'synced' })
    } catch (err) {
      console.warn('[playerSync] pushPlayerOutbox failed for outbox item', item.id, err)
      await db.outbox.update(item.id, {
        status: 'failed',
        retryCount: (item.retryCount ?? 0) + 1,
      })
      try {
        await db.players.update(1, { syncStatus: 'error' })
      } catch (_) {}
    }
  }
}

/**
 * Pulls player_state from Supabase and merges into the local Dexie player record.
 *
 * Merge strategy (last-write-wins by updated_at):
 *  - If remote.updated_at > local.updatedAt → overwrite synced fields.
 *  - Local-only fields (combo, lastCompleteAt, achievementsUnlocked) are always preserved.
 *  - If no local player exists → create one from remote data.
 *
 * Updates localStorage key "taskquest.playerLastPulledAt" on success.
 *
 * @param {{ supabase: object, userId: string }} params
 */
export async function pullPlayerRemote({ supabase, userId }) {
  if (!supabase || !userId) return

  const now = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from('player_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      // No remote player yet — nothing to merge
      localStorage.setItem(PLAYER_LAST_PULLED_KEY, now)
      return
    }

    const local = await db.players.get(1)

    if (shouldOverwritePlayer(local, data)) {
      // Spread local first to preserve non-synced fields (combo, lastCompleteAt, etc.)
      const rawMerged = {
        ...(local ?? {}),
        id: 1,
        xp: data.xp ?? 0,
        streak: data.streak ?? 0,
        lastActiveDate: data.last_active_date ?? null,
        dailyGoal: data.daily_goal ?? 3,
        rewardsUnlocked: data.unlocked_rewards ?? [],
        unlockedCharacters: data.unlocked_characters ?? [],
        activeTeam: data.active_team ?? [],
        updatedAt: data.updated_at,
        syncStatus: 'synced',
        coins: data.coins ?? 0,
        energy: data.energy ?? 100,
        energyCap: data.energy_cap ?? 100,
        lastIdleTickAt: data.last_idle_tick_at ?? null,
        boosts: data.boosts ?? [],
        coinsPerMinuteBase: data.coins_per_minute_base ?? 1,
        currentZone: data.current_zone ?? 1,
        zoneUnlockedMax: data.zone_unlocked_max ?? 1,
        zoneProgress: data.zone_progress ?? {},
        powerScoreCache: data.power_score_cache ?? 0,
        // Talent tree fields (PR21)
        essence:      data.essence       ?? 0,
        talents:      data.talents        ?? { idle: 0, gacha: 0, power: 0 },
        essenceSpent: data.essence_spent  ?? 0,
      }
      // Guardrail: clamp numeric fields from remote to prevent corrupted data
      const merged = clampPlayer(rawMerged)
      // Re-apply non-clamped identity/metadata fields overwritten by clamp spread
      merged.id = 1
      merged.updatedAt = rawMerged.updatedAt
      merged.syncStatus = 'synced'
      merged.lastActiveDate = rawMerged.lastActiveDate
      merged.rewardsUnlocked = rawMerged.rewardsUnlocked
      merged.unlockedCharacters = rawMerged.unlockedCharacters
      merged.activeTeam = rawMerged.activeTeam
      merged.lastIdleTickAt = rawMerged.lastIdleTickAt
      merged.currentZone = rawMerged.currentZone
      merged.zoneUnlockedMax = rawMerged.zoneUnlockedMax
      merged.zoneProgress = rawMerged.zoneProgress
      merged.powerScoreCache = rawMerged.powerScoreCache
      merged.talents = rawMerged.talents
      await db.players.put(merged)
    }

    localStorage.setItem(PLAYER_LAST_PULLED_KEY, now)
  } catch (err) {
    console.warn('[playerSync] pullPlayerRemote failed', err)
  }
}
