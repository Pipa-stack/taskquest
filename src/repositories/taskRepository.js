import db from '../db/db.js'
import { getDeviceId } from '../lib/deviceId.js'

/**
 * Builds the minimal task snapshot to store in the outbox payload.
 */
function taskToPayload(task) {
  return {
    localId: task.localId ?? task.id,
    title: task.title,
    dueDate: task.dueDate,
    status: task.status,
    isClone: task.isClone ?? false,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
    deviceId: task.deviceId ?? getDeviceId(),
    updatedAt: task.updatedAt,
  }
}

/**
 * Low-level task repository. Handles Dexie reads/writes for tasks.
 * All mutations also enqueue an outbox entry for remote sync.
 *
 * UI reactivity comes from useLiveQuery in the hooks layer — this
 * repository never touches React state directly.
 */
export const taskRepository = {
  /**
   * Creates a new task and enqueues a UPSERT_TASK outbox entry.
   * Returns the auto-generated task id.
   */
  async create({ title, dueDate, isClone }) {
    const now = new Date().toISOString()
    const deviceId = getDeviceId()
    let taskId

    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      taskId = await db.tasks.add({
        title,
        dueDate,
        status: 'pending',
        createdAt: now,
        isClone: isClone ?? false,
        deviceId,
        updatedAt: now,
        syncStatus: 'pending',
      })

      // Set localId = id (two-step because id is auto-generated)
      await db.tasks.update(taskId, { localId: taskId })

      const task = await db.tasks.get(taskId)
      await db.outbox.add({
        createdAt: now,
        status: 'pending',
        type: 'UPSERT_TASK',
        payload: taskToPayload(task),
        retryCount: 0,
      })
    })

    return taskId
  },

  /**
   * Enqueues a UPSERT_TASK outbox entry for an already-updated task.
   * Called after completeTask mutations (which happen inside a bigger transaction).
   */
  async enqueueUpsert(task, nowISO) {
    await db.outbox.add({
      createdAt: nowISO,
      status: 'pending',
      type: 'UPSERT_TASK',
      payload: taskToPayload(task),
      retryCount: 0,
    })
  },
}
