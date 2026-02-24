import Dexie from 'dexie'

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
 * dailyQuests
 *   dateKey  – YYYY-MM-DD (primary key); the day these quests belong to
 *   quests   – JSON array of quest objects (id, type, title, xpReward, target, rewardClaimed)
 *
 * weeklyChallenge
 *   weekKey        – "week-YYYY-MM-DD" of Monday (primary key)
 *   rewardClaimed  – boolean; true once XP + badge have been awarded
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
  tasks: '++id, dueDate, status, createdAt, [dueDate+status]',
  players: '++id',
  dailyQuests: 'dateKey',
  weeklyChallenge: 'weekKey',
})

export default db
