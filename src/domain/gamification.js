// XP awarded per difficulty tier
export const XP_BY_DIFFICULTY = {
  easy: 10,
  medium: 25,
  hard: 50,
}

// Static level table — extend as needed for future phases
const LEVEL_TABLE = [
  { level: 1,  title: 'Novato',       xpRequired: 0 },
  { level: 2,  title: 'Aprendiz',     xpRequired: 100 },
  { level: 3,  title: 'Explorador',   xpRequired: 250 },
  { level: 4,  title: 'Aventurero',   xpRequired: 500 },
  { level: 5,  title: 'Veterano',     xpRequired: 900 },
  { level: 6,  title: 'Élite',        xpRequired: 1400 },
  { level: 7,  title: 'Maestro',      xpRequired: 2100 },
  { level: 8,  title: 'Gran Maestro', xpRequired: 3000 },
  { level: 9,  title: 'Legendario',   xpRequired: 4200 },
  { level: 10, title: 'Inmortal',     xpRequired: 6000 },
]

export const getXpForDifficulty = (difficulty) =>
  XP_BY_DIFFICULTY[difficulty] ?? XP_BY_DIFFICULTY.medium

/**
 * Returns the level config the player currently occupies given total XP.
 */
export const getLevelFromXp = (totalXp) => {
  let current = LEVEL_TABLE[0]
  for (const entry of LEVEL_TABLE) {
    if (totalXp >= entry.xpRequired) current = entry
    else break
  }
  return current
}

export const getNextLevel = (currentLevel) =>
  LEVEL_TABLE.find((e) => e.level === currentLevel + 1) ?? null

/**
 * Returns data needed to render an XP progress bar.
 */
export const getXpProgress = (totalXp) => {
  const current = getLevelFromXp(totalXp)
  const next = getNextLevel(current.level)

  if (!next) return { current, next: null, progress: 100, xpInLevel: 0, xpNeeded: 0 }

  const xpInLevel = totalXp - current.xpRequired
  const xpNeeded  = next.xpRequired - current.xpRequired
  const progress  = Math.floor((xpInLevel / xpNeeded) * 100)

  return { current, next, progress, xpInLevel, xpNeeded }
}

/**
 * Flat XP bonus added per completed task based on current streak.
 * Capped to avoid runaway compounding in MVP.
 */
export const calculateStreakBonus = (streak) => Math.min(streak * 2, 20)
