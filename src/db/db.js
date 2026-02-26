import Dexie from 'dexie'
import { getDeviceId } from '../lib/deviceId.js'

/**
 * TaskQuest IndexedDB database (Dexie wrapper).
 *
 * Schema v1
 * ---------
 * tasks
 *   ++id          – auto-increment primary key
 *   dueDate       – YYYY-MM-DD (local TZ); index for "tasks for today" queries
 *   status        – 'pending' | 'done'; index for filtering
 *   createdAt     – ISO-8601 timestamp; index for chronological ordering
 *   [dueDate+status] – compound index: pending tasks for a given date
 *
 * players
 *   ++id          – auto-increment PK (single-player: id=1)
 *                   (no additional indexes needed; always fetched by id=1)
 *
 * Schema v2
 * ---------
 * players gains:
 *   combo            – current combo multiplier (1.0–1.4)
 *   lastCompleteAt   – ISO timestamp of last task completion (for combo decay)
 *   dailyGoal        – target tasks per day (default 3)
 *   achievementsUnlocked – array of achievement ids
 *   rewardsUnlocked  – array of reward ids
 *
 * Schema v3
 * ---------
 * tasks gains new indexes:
 *   deviceId         – device that created the task (multi-device sync)
 *   localId          – mirrors the auto-increment id; stable reference for remote
 *   [deviceId+localId] – compound index for sync lookups
 *   syncStatus       – 'pending' | 'synced' | 'error'
 *
 * outbox (new table)
 *   ++id      – auto-increment
 *   createdAt – ISO timestamp; used for ordering
 *   status    – 'pending' | 'sent' | 'failed'
 *   type      – 'UPSERT_TASK' | 'DELETE_TASK' | 'UPSERT_PLAYER'
 *   payload   – task or player snapshot object
 *   retryCount – number of failed attempts
 *
 * Schema v4
 * ---------
 * players gains:
 *   updatedAt  – ISO timestamp for sync conflict resolution
 *   syncStatus – 'pending' | 'synced' | 'error' (offline-first indicator)
 *
 * Schema v5
 * ---------
 * players gains:
 *   unlockedCharacters – string[] of unlocked character ids (default [])
 *   activeTeam         – string[] of up to 3 character ids in active team (default [])
 *
 * Supabase (run manually, not from code):
 *   alter table public.player_state
 *     add column if not exists unlocked_characters jsonb not null default '[]'::jsonb;
 *   alter table public.player_state
 *     add column if not exists active_team jsonb not null default '[]'::jsonb;
 */
const db = new Dexie('taskquest')

db.version(1).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status]',
  players: '++id',
})

db.version(2).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status]',
  players: '++id',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (player.combo === undefined) player.combo = 1.0
    if (player.lastCompleteAt === undefined) player.lastCompleteAt = null
    if (player.dailyGoal === undefined) player.dailyGoal = 3
    if (player.achievementsUnlocked === undefined) player.achievementsUnlocked = []
    if (player.rewardsUnlocked === undefined) player.rewardsUnlocked = []
  })
})

db.version(3).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  const deviceId = getDeviceId()
  const now = new Date().toISOString()
  return tx.tasks.toCollection().modify((task) => {
    if (!task.deviceId) task.deviceId = deviceId
    if (task.localId === undefined) task.localId = task.id
    if (!task.updatedAt) task.updatedAt = task.createdAt || now
    if (!task.syncStatus) task.syncStatus = 'synced' // existing tasks are considered already synced
  })
})

db.version(4).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  const now = new Date().toISOString()
  return tx.players.toCollection().modify((player) => {
    if (!player.updatedAt) player.updatedAt = now
    if (!player.syncStatus) player.syncStatus = 'pending'
  })
})

db.version(5).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (!player.unlockedCharacters) player.unlockedCharacters = []
    if (!player.activeTeam) player.activeTeam = []
  })
})

/**
 * Schema v6
 * ---------
 * players gains idle-farming fields:
 *   coins              – passive currency earned via idle ticks (default 0)
 *   energy             – consumed 1 per idle minute; replenishes over time (default 100)
 *   energyCap          – maximum energy (default 100; can be boosted)
 *   lastIdleTickAt     – ISO timestamp of last idle tick (nullable)
 *   boosts             – array of active boost objects { id, expiresAt?, coinMultiplier?, energyCapBonus? }
 *   coinsPerMinuteBase – base rate before team and boost multipliers (default 1)
 *
 * Supabase (run manually):
 *   alter table public.player_state
 *     add column if not exists coins int not null default 0,
 *     add column if not exists energy int not null default 100,
 *     add column if not exists energy_cap int not null default 100,
 *     add column if not exists last_idle_tick_at timestamptz,
 *     add column if not exists boosts jsonb not null default '[]'::jsonb,
 *     add column if not exists coins_per_minute_base int not null default 1;
 */
db.version(6).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (player.coins === undefined) player.coins = 0
    if (player.energy === undefined) player.energy = 100
    if (player.energyCap === undefined) player.energyCap = 100
    if (player.lastIdleTickAt === undefined) player.lastIdleTickAt = null
    if (!player.boosts) player.boosts = []
    if (player.coinsPerMinuteBase === undefined) player.coinsPerMinuteBase = 1
  })
})

/**
 * Schema v7
 * ---------
 * players gains gacha/pack fields:
 *   shards        – jsonb map { [characterId]: number } duplicate shards (default {})
 *   dust          – bigint secondary currency from duplicates (default 0)
 *   gachaHistory  – jsonb array of last 20 pull results (default [])
 *   pityLegendary – int pull counter toward guaranteed legendary (default 0)
 *
 * Supabase (run manually):
 *   alter table public.player_state
 *     add column if not exists shards jsonb not null default '{}'::jsonb,
 *     add column if not exists dust bigint not null default 0,
 *     add column if not exists gacha_history jsonb not null default '[]'::jsonb,
 *     add column if not exists pity_legendary int not null default 0;
 */
db.version(7).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (!player.shards) player.shards = {}
    if (player.dust === undefined) player.dust = 0
    if (!player.gachaHistory) player.gachaHistory = []
    if (player.pityLegendary === undefined) player.pityLegendary = 0
  })
})

export default db
