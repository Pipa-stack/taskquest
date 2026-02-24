import { describe, it, expect } from 'vitest'
import {
  checkNewAchievements,
  getAchievement,
  ACHIEVEMENTS,
} from '../../domain/achievements.js'

// Base context – nothing unlocked
const baseCtx = {
  totalTasks: 0,
  todayTasks: 0,
  streak: 0,
  dailyGoalMet: false,
  combo: 1.0,
}

describe('checkNewAchievements – basic unlock', () => {
  it('unlocks first_blood at 1 total task', () => {
    const result = checkNewAchievements([], { ...baseCtx, totalTasks: 1 })
    expect(result).toContain('first_blood')
  })

  it('unlocks getting_started at 5 total tasks', () => {
    const result = checkNewAchievements([], { ...baseCtx, totalTasks: 5 })
    expect(result).toContain('getting_started')
  })

  it('unlocks grinder at 25 total tasks', () => {
    const result = checkNewAchievements([], { ...baseCtx, totalTasks: 25 })
    expect(result).toContain('grinder')
  })

  it('unlocks daily_hero when dailyGoalMet is true', () => {
    const result = checkNewAchievements([], { ...baseCtx, dailyGoalMet: true })
    expect(result).toContain('daily_hero')
  })

  it('unlocks streak_3 at streak 3', () => {
    const result = checkNewAchievements([], { ...baseCtx, streak: 3 })
    expect(result).toContain('streak_3')
  })

  it('unlocks streak_7 at streak 7', () => {
    const result = checkNewAchievements([], { ...baseCtx, streak: 7 })
    expect(result).toContain('streak_7')
  })

  it('unlocks combo_1_3 when combo >= 1.3', () => {
    const result = checkNewAchievements([], { ...baseCtx, combo: 1.3 })
    expect(result).toContain('combo_1_3')
  })

  it('unlocks ten_today at 10 tasks today', () => {
    const result = checkNewAchievements([], { ...baseCtx, todayTasks: 10 })
    expect(result).toContain('ten_today')
  })
})

describe('checkNewAchievements – no duplicate unlocks', () => {
  it('does NOT re-unlock first_blood if already in unlockedIds', () => {
    const result = checkNewAchievements(['first_blood'], { ...baseCtx, totalTasks: 1 })
    expect(result).not.toContain('first_blood')
  })

  it('does NOT re-unlock any achievements already in list', () => {
    const already = ['first_blood', 'getting_started', 'streak_3']
    const result = checkNewAchievements(already, {
      ...baseCtx,
      totalTasks: 5,
      streak: 3,
    })
    expect(result).not.toContain('first_blood')
    expect(result).not.toContain('getting_started')
    expect(result).not.toContain('streak_3')
  })

  it('returns empty array when nothing new qualifies', () => {
    const result = checkNewAchievements([], baseCtx)
    expect(result).toEqual([])
  })
})

describe('checkNewAchievements – daily goal completion', () => {
  it('does not unlock daily_hero when goal not met', () => {
    const result = checkNewAchievements([], { ...baseCtx, dailyGoalMet: false })
    expect(result).not.toContain('daily_hero')
  })

  it('unlocks daily_hero exactly when dailyGoalMet flips to true', () => {
    const result = checkNewAchievements([], { ...baseCtx, dailyGoalMet: true })
    expect(result).toContain('daily_hero')
  })
})

describe('checkNewAchievements – combo threshold', () => {
  it('does not unlock combo_1_3 at combo 1.2', () => {
    const result = checkNewAchievements([], { ...baseCtx, combo: 1.2 })
    expect(result).not.toContain('combo_1_3')
  })

  it('unlocks combo_1_3 at combo exactly 1.3', () => {
    const result = checkNewAchievements([], { ...baseCtx, combo: 1.3 })
    expect(result).toContain('combo_1_3')
  })

  it('unlocks combo_1_3 at combo 1.4 too', () => {
    const result = checkNewAchievements([], { ...baseCtx, combo: 1.4 })
    expect(result).toContain('combo_1_3')
  })
})

describe('checkNewAchievements – multiple at once', () => {
  it('can unlock multiple achievements in a single call', () => {
    const result = checkNewAchievements([], {
      ...baseCtx,
      totalTasks: 25,
      todayTasks: 10,
      streak: 7,
      dailyGoalMet: true,
      combo: 1.4,
    })
    expect(result).toContain('first_blood')
    expect(result).toContain('getting_started')
    expect(result).toContain('grinder')
    expect(result).toContain('daily_hero')
    expect(result).toContain('streak_3')
    expect(result).toContain('streak_7')
    expect(result).toContain('combo_1_3')
    expect(result).toContain('ten_today')
    expect(result).toHaveLength(8)
  })
})

describe('getAchievement', () => {
  it('returns achievement by id', () => {
    const a = getAchievement('first_blood')
    expect(a).toBeDefined()
    expect(a.title).toBe('First Blood')
  })

  it('returns undefined for unknown id', () => {
    expect(getAchievement('nonexistent')).toBeUndefined()
  })

  it('ACHIEVEMENTS list has exactly 8 entries', () => {
    expect(ACHIEVEMENTS).toHaveLength(8)
  })
})
