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
 * players gains zone meta-game fields:
 *   currentZone      – current active zone id (default 1)
 *   zoneUnlockedMax  – highest zone unlocked (default 1)
 *   zoneProgress     – { [zoneId]: { claimedRewards: string[] } } (default {})
 *   powerScoreCache  – cached power score, recalculable from team (default 0)
 *
 * Supabase (run manually):
 *   alter table public.player_state
 *     add column if not exists current_zone int not null default 1,
 *     add column if not exists zone_unlocked_max int not null default 1,
 *     add column if not exists zone_progress jsonb not null default '{}'::jsonb,
 *     add column if not exists power_score_cache int not null default 0;
 */
db.version(7).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (player.currentZone === undefined) player.currentZone = 1
    if (player.zoneUnlockedMax === undefined) player.zoneUnlockedMax = 1
    if (player.zoneProgress === undefined) player.zoneProgress = {}
    if (player.powerScoreCache === undefined) player.powerScoreCache = 0
  })
})

/**
 * Schema v8
 * ---------
 * players gains talent-tree fields:
 *   essence       – resource currency for spending on talent points (default 0)
 *   talents       – { idle, gacha, power } talent levels 0–10 (default {})
 *   essenceSpent  – cumulative essence spent across all talent branches (default 0)
 *
 * Supabase (run manually):
 *   alter table public.player_state
 *     add column if not exists essence int not null default 0,
 *     add column if not exists talents jsonb not null default '{}'::jsonb,
 *     add column if not exists essence_spent int not null default 0;
 */
db.version(8).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (player.essence === undefined) player.essence = 0
    if (!player.talents) player.talents = { idle: 0, gacha: 0, power: 0 }
    if (player.essenceSpent === undefined) player.essenceSpent = 0
  })
})

/**
 * Schema v9
 * ---------
 * players gains onboarding + daily-loop tracking fields:
 *   onboardingDone       – boolean; true once tutorial dismissed (default false)
 *   onboardingStep       – int 1–3; current onboarding step (default 1)
 *   lastIdleClaimDate    – YYYY-MM-DD; last date the player manually claimed idle coins (nullable)
 *   lastGachaPullDate    – YYYY-MM-DD; last date the player did a gacha pull (nullable)
 *   dailyLoopClaimedDate – YYYY-MM-DD; last date the daily loop reward was claimed (nullable)
 *
 * Supabase (run manually):
 *   alter table public.player_state
 *     add column if not exists onboarding_done boolean not null default false,
 *     add column if not exists onboarding_step int not null default 1,
 *     add column if not exists last_idle_claim_date text,
 *     add column if not exists last_gacha_pull_date text,
 *     add column if not exists daily_loop_claimed_date text;
 */
db.version(9).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status], deviceId, localId, [deviceId+localId], syncStatus',
  players: '++id',
  outbox: '++id, createdAt, status, type',
}).upgrade((tx) => {
  return tx.players.toCollection().modify((player) => {
    if (player.onboardingDone === undefined) player.onboardingDone = false
    if (player.onboardingStep === undefined) player.onboardingStep = 1
    if (player.lastIdleClaimDate === undefined) player.lastIdleClaimDate = null
    if (player.lastGachaPullDate === undefined) player.lastGachaPullDate = null
    if (player.dailyLoopClaimedDate === undefined) player.dailyLoopClaimedDate = null
  })
})

export default db
