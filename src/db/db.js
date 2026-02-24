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
 * Bump db.version() whenever the schema or data shape changes. Existing data
 * is migrated inside the version().upgrade() callback.
 */
const db = new Dexie('taskquest')

db.version(1).stores({
  tasks: '++id, dueDate, status, createdAt, [dueDate+status]',
  players: '++id',
})

export default db
