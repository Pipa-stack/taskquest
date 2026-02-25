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
 * NOTE for PR11: player_state remote table will gain unlocked_characters jsonb
 * to support Character Drops when completing tasks. The local players table
 * will also gain an unlockedCharacters field at that point.
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

export default db
