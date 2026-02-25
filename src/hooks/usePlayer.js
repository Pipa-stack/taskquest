import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { xpToLevel, xpToNextLevel } from '../domain/gamification.js'

const DEFAULT = {
  xp: 0,
  level: 1,
  streak: 0,
  xpToNext: 500,
  lastActiveDate: null,
  combo: 1.0,
  lastCompleteAt: null,
  dailyGoal: 3,
  achievementsUnlocked: [],
  rewardsUnlocked: [],
  coins: 0,
  unlockedCharacters: [],
  syncStatus: null,
}

/**
 * Returns live-reactive player stats derived from the single player record (id=1).
 * Falls back to zero-state defaults before the first task is ever completed.
 */
export function usePlayer() {
  const player = useLiveQuery(() => db.players.get(1), [])

  if (!player) return DEFAULT

  return {
    xp: player.xp,
    level: xpToLevel(player.xp),
    streak: player.streak ?? 0,
    xpToNext: xpToNextLevel(player.xp),
    lastActiveDate: player.lastActiveDate,
    combo: player.combo ?? 1.0,
    lastCompleteAt: player.lastCompleteAt ?? null,
    dailyGoal: player.dailyGoal ?? 3,
    achievementsUnlocked: player.achievementsUnlocked ?? [],
    rewardsUnlocked: player.rewardsUnlocked ?? [],
    coins: player.coins ?? 0,
    unlockedCharacters: player.unlockedCharacters ?? [],
    syncStatus: player.syncStatus ?? null,
  }
}
