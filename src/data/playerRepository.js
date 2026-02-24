import { db } from './db.js'

const DEFAULT_PLAYER = {
  id:             1,
  xp:             0,
  level:          1,
  streak:         0,
  lastActiveDate: null,
}

export const playerRepository = {
  /** Returns the player record, creating it with defaults if it doesn't exist. */
  async get() {
    const player = await db.player.get(1)
    if (!player) {
      await db.player.put(DEFAULT_PLAYER)
      return { ...DEFAULT_PLAYER }
    }
    return player
  },

  /**
   * Merges partial data into the existing player record.
   * Uses a read-then-put to guarantee a complete object is always stored.
   */
  async update(data) {
    const current = await this.get()
    const updated = { ...current, ...data }
    await db.player.put(updated)
    return updated
  },
}
