import { db } from './db.js'

const todayStr = () => new Date().toISOString().split('T')[0]

export const taskRepository = {
  /** All tasks whose dueDate matches today. */
  async getToday() {
    return db.tasks.where('dueDate').equals(todayStr()).toArray()
  },

  /** Persist a new task and return it with the generated id. */
  async create(taskData) {
    const id = await db.tasks.add(taskData)
    return { ...taskData, id }
  },

  /** Mark a task completed. */
  async complete(taskId) {
    await db.tasks.update(taskId, {
      status:      'completed',
      completedAt: new Date().toISOString(),
    })
  },
}
