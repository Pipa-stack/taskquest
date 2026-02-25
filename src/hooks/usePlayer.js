import { useLiveQuery } from 'dexie-react-hooks'
import { xpToLevel, xpToNextLevel } from '../domain/gamification.js'
import * as playerRepository from '../repositories/playerRepository.js'

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
}

/**
 * Returns live-reactive player stats derived from the single player record (id=1).
 * Falls back to zero-state defaults before the first task is ever completed.
 *
 * DB access is fully delegated to playerRepository — this hook never imports db.
 * Dexie tracks the read inside useLiveQuery and re-renders on any player change.
 */
export function usePlayer() {
  const player = useLiveQuery(() => playerRepository.getLive(), [])

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
  }
}
