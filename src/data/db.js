import Dexie from 'dexie'

/**
 * Single Dexie instance for the whole app.
 * Indexes are declared here; add new version blocks (never mutate existing ones)
 * whenever the schema evolves.
 */
export const db = new Dexie('TaskQuestDB')

db.version(1).stores({
  // tasks: auto-increment PK + indexed fields for queries
  tasks:  '++id, status, dueDate, createdAt',
  // player: single-row table keyed by fixed id=1
  player: 'id',
})
