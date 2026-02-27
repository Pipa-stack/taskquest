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
  unlockedCharacters: [],
  activeTeam: [],
  syncStatus: null,
  coins: 0,
  energy: 100,
  energyCap: 100,
  lastIdleTickAt: null,
  boosts: [],
  coinsPerMinuteBase: 1,
  currentZone: 1,
  zoneUnlockedMax: 1,
  zoneProgress: {},
  powerScoreCache: 0,
  // Talent tree fields (PR21)
  essence: 0,
  talents: { idle: 0, gacha: 0, power: 0 },
  essenceSpent: 0,
  // Onboarding + daily loop fields (PR23)
  onboardingDone: false,
  onboardingStep: 1,
  dailyLoopClaimedDate: null,
  lastIdleClaimDate: null,
  lastGachaPullDate: null,
  gachaPityCount: 0,
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
    unlockedCharacters: player.unlockedCharacters ?? [],
    activeTeam: player.activeTeam ?? [],
    syncStatus: player.syncStatus ?? null,
    coins: player.coins ?? 0,
    energy: player.energy ?? 100,
    energyCap: player.energyCap ?? 100,
    lastIdleTickAt: player.lastIdleTickAt ?? null,
    boosts: player.boosts ?? [],
    coinsPerMinuteBase: player.coinsPerMinuteBase ?? 1,
    currentZone: player.currentZone ?? 1,
    zoneUnlockedMax: player.zoneUnlockedMax ?? 1,
    zoneProgress: player.zoneProgress ?? {},
    powerScoreCache: player.powerScoreCache ?? 0,
    // Talent tree fields (PR21)
    essence:      player.essence      ?? 0,
    talents:      player.talents      ?? { idle: 0, gacha: 0, power: 0 },
    essenceSpent: player.essenceSpent ?? 0,
    // Onboarding + daily loop fields (PR23)
    onboardingDone:       player.onboardingDone       ?? false,
    onboardingStep:       player.onboardingStep       ?? 1,
    dailyLoopClaimedDate: player.dailyLoopClaimedDate ?? null,
    lastIdleClaimDate:    player.lastIdleClaimDate    ?? null,
    lastGachaPullDate:    player.lastGachaPullDate    ?? null,
    gachaPityCount:       player.gachaPityCount       ?? 0,
  }
}
