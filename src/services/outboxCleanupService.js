import db from '../db/db.js'

/** Maximum retry attempts before an outbox item is considered dead-letter. */
export const MAX_RETRIES = 5

/**
 * Deletes outbox items that have permanently failed (status='failed' and
 * retryCount >= MAX_RETRIES). These items will never be retried and would
 * accumulate in IndexedDB indefinitely without this cleanup.
 *
 * Runs in a single bulk delete — no transactions needed because we're only
 * deleting records, not updating dependent tables.
 *
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ deleted: number }>}
 */
export async function cleanupDeadOutbox({ limit = 500 } = {}) {
  const dead = await db.outbox
    .where('status')
    .equals('failed')
    .filter((x) => (x.retryCount ?? 0) >= MAX_RETRIES)
    .limit(limit)
    .toArray()

  if (dead.length === 0) return { deleted: 0 }

  await db.outbox.bulkDelete(dead.map((x) => x.id))
  return { deleted: dead.length }
}
