import db from '../db/db.js'

const LAST_PULLED_KEY = 'taskquest.lastPulledAt'
const PUSH_BATCH_SIZE = 25
const PULL_LIMIT = 500

/**
 * Pure helper: decides whether a remote task should overwrite the local one.
 * Exported for unit testing.
 *
 * @param {string|null|undefined} localUpdatedAt  – ISO string or nullish
 * @param {string} remoteUpdatedAt               – ISO string
 * @returns {boolean}
 */
export function shouldOverwrite(localUpdatedAt, remoteUpdatedAt) {
  if (!localUpdatedAt) return true
  return remoteUpdatedAt > localUpdatedAt
}

/**
 * Pushes pending outbox entries to Supabase.
 * Processes up to PUSH_BATCH_SIZE items ordered by createdAt.
 *
 * On success: marks outbox item 'sent', marks task syncStatus='synced'.
 * On failure: marks outbox item 'failed', increments retryCount.
 *
 * @param {{ supabase: object, userId: string }} params
 */
export async function pushOutbox({ supabase, userId }) {
  if (!supabase || !userId) return

  const allPending = await db.outbox
    .where('status')
    .equals('pending')
    .sortBy('createdAt')

  const batch = allPending.slice(0, PUSH_BATCH_SIZE)

  for (const item of batch) {
    try {
      const p = item.payload

      const remoteTask = {
        user_id: userId,
        device_id: p.deviceId,
        local_id: p.localId,
        title: p.title,
        due_date: p.dueDate,
        status: p.status,
        is_clone: p.isClone ?? false,
        created_at: p.createdAt,
        completed_at: p.completedAt ?? null,
        updated_at: p.updatedAt,
      }

      const { error } = await supabase
        .from('tasks')
        .upsert(remoteTask, { onConflict: 'user_id,device_id,local_id' })

      if (error) throw error

      // Mark outbox entry as sent
      await db.outbox.update(item.id, { status: 'sent' })

      // Mark the local task as synced
      await db.tasks
        .where('[deviceId+localId]')
        .equals([p.deviceId, p.localId])
        .modify({ syncStatus: 'synced' })
    } catch (err) {
      console.warn('[taskSync] pushOutbox failed for outbox item', item.id, err)
      await db.outbox.update(item.id, {
        status: 'failed',
        retryCount: (item.retryCount ?? 0) + 1,
      })
      // Mark local task as error so the UI can show ⚠️
      try {
        const p = item.payload
        await db.tasks
          .where('[deviceId+localId]')
          .equals([p.deviceId, p.localId])
          .modify({ syncStatus: 'error' })
      } catch (_) {}
    }
  }
}

/**
 * Pulls tasks updated since lastPulledAt from Supabase and merges them into Dexie.
 *
 * Merge strategy:
 *  - Existing local task (matched by deviceId+localId):
 *      overwrite if remote.updated_at > local.updatedAt
 *  - New remote task (not found locally):
 *      insert with a new auto-increment id; preserve deviceId/localId fields.
 *
 * Updates localStorage key "taskquest.lastPulledAt" on success.
 *
 * @param {{ supabase: object, userId: string }} params
 */
export async function pullRemote({ supabase, userId }) {
  if (!supabase || !userId) return

  const lastPulledAt =
    localStorage.getItem(LAST_PULLED_KEY) ?? '1970-01-01T00:00:00.000Z'
  const now = new Date().toISOString()

  try {
    const { data: remoteTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastPulledAt)
      .order('updated_at', { ascending: true })
      .limit(PULL_LIMIT)

    if (error) throw error
    if (!remoteTasks?.length) {
      localStorage.setItem(LAST_PULLED_KEY, now)
      return
    }

    for (const remote of remoteTasks) {
      const localMatches = await db.tasks
        .where('[deviceId+localId]')
        .equals([remote.device_id, remote.local_id])
        .toArray()

      const local = localMatches[0] ?? null

      if (local) {
        if (shouldOverwrite(local.updatedAt, remote.updated_at)) {
          await db.tasks.update(local.id, {
            title: remote.title,
            dueDate: remote.due_date,
            status: remote.status,
            isClone: remote.is_clone ?? false,
            completedAt: remote.completed_at ?? null,
            updatedAt: remote.updated_at,
            syncStatus: 'synced',
          })
        }
      } else {
        // Insert new task from another device. Do NOT force id=localId to
        // avoid collisions with existing local auto-increment ids.
        await db.tasks.add({
          title: remote.title,
          dueDate: remote.due_date,
          status: remote.status,
          isClone: remote.is_clone ?? false,
          createdAt: remote.created_at,
          completedAt: remote.completed_at ?? null,
          deviceId: remote.device_id,
          localId: remote.local_id,
          updatedAt: remote.updated_at,
          syncStatus: 'synced',
        })
      }
    }

    localStorage.setItem(LAST_PULLED_KEY, now)
  } catch (err) {
    console.warn('[taskSync] pullRemote failed', err)
  }
}
