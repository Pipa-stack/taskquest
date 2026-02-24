import { describe, it, expect } from 'vitest'
import {
  QUEST_POOL,
  generateDailyQuests,
  evaluateQuest,
  buildQuestContext,
  evaluateWeeklyChallenge,
  isHardTask,
  WEEKLY_TASK_TARGET,
  WEEKLY_XP_TARGET,
} from '../../domain/quests.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePlayer = {
  combo: 1.0,
  streak: 0,
  dailyGoal: 3,
}

function makeTask(overrides = {}) {
  return {
    status: 'done',
    isClone: false,
    title: 'Task',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Quest pool
// ---------------------------------------------------------------------------

describe('QUEST_POOL', () => {
  it('has at least 10 quests', () => {
    expect(QUEST_POOL.length).toBeGreaterThanOrEqual(10)
  })

  it('every quest has required fields', () => {
    for (const q of QUEST_POOL) {
      expect(q).toHaveProperty('id')
      expect(q).toHaveProperty('type')
      expect(q).toHaveProperty('title')
      expect(q).toHaveProperty('xpReward')
      expect(q).toHaveProperty('target')
      expect(typeof q.xpReward).toBe('number')
      expect(q.xpReward).toBeGreaterThan(0)
    }
  })

  it('all ids are unique', () => {
    const ids = QUEST_POOL.map((q) => q.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// Daily quest generation – stability & determinism
// ---------------------------------------------------------------------------

describe('generateDailyQuests', () => {
  it('returns exactly 3 quests by default', () => {
    expect(generateDailyQuests('2026-02-24')).toHaveLength(3)
  })

  it('same dateKey always returns same quests (stable)', () => {
    const a = generateDailyQuests('2026-02-24')
    const b = generateDailyQuests('2026-02-24')
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
  })

  it('different dateKeys produce different orderings (usually)', () => {
    const a = generateDailyQuests('2026-02-24').map((q) => q.id)
    const b = generateDailyQuests('2026-02-25').map((q) => q.id)
    const c = generateDailyQuests('2026-02-26').map((q) => q.id)
    // At least two of the three days should differ
    const allSame = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c)
    expect(allSame).toBe(false)
  })

  it('all returned quests are from the pool', () => {
    const poolIds = new Set(QUEST_POOL.map((q) => q.id))
    const daily = generateDailyQuests('2026-03-01')
    for (const q of daily) {
      expect(poolIds.has(q.id)).toBe(true)
    }
  })

  it('no duplicate quests in a single day', () => {
    const quests = generateDailyQuests('2026-02-24')
    const ids = quests.map((q) => q.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('rewardClaimed starts as false', () => {
    const quests = generateDailyQuests('2026-02-24')
    for (const q of quests) {
      expect(q.rewardClaimed).toBe(false)
    }
  })

  it('respects custom count', () => {
    expect(generateDailyQuests('2026-02-24', 5)).toHaveLength(5)
  })

  it('different dateKeys → stable, predictable reset per day', () => {
    const monday = generateDailyQuests('2026-02-23').map((q) => q.id)
    const tuesday = generateDailyQuests('2026-02-24').map((q) => q.id)
    // Generating monday again returns the same set
    const mondayAgain = generateDailyQuests('2026-02-23').map((q) => q.id)
    expect(monday).toEqual(mondayAgain)
    // Tuesday is a different selection
    expect(monday).not.toEqual(tuesday)
  })
})

// ---------------------------------------------------------------------------
// isHardTask
// ---------------------------------------------------------------------------

describe('isHardTask', () => {
  it('detects "hard" keyword', () => {
    expect(isHardTask('A hard task')).toBe(true)
  })

  it('detects "difícil" keyword', () => {
    expect(isHardTask('Tarea difícil')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isHardTask('HARD TASK')).toBe(true)
    expect(isHardTask('URGENTE')).toBe(true)
  })

  it('returns false for normal tasks', () => {
    expect(isHardTask('Buy groceries')).toBe(false)
    expect(isHardTask('Read a book')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildQuestContext
// ---------------------------------------------------------------------------

describe('buildQuestContext', () => {
  it('counts done tasks only', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'pending' }),
    ]
    const ctx = buildQuestContext(tasks, basePlayer)
    expect(ctx.todayDoneCount).toBe(1)
  })

  it('counts clone tasks separately', () => {
    const tasks = [
      makeTask({ isClone: false }),
      makeTask({ isClone: true }),
    ]
    const ctx = buildQuestContext(tasks, basePlayer)
    expect(ctx.todayCloneCount).toBe(1)
    expect(ctx.todayDoneCount).toBe(2)
  })

  it('counts hard tasks by keyword', () => {
    const tasks = [
      makeTask({ title: 'Hard exercise' }),
      makeTask({ title: 'Easy walk' }),
    ]
    const ctx = buildQuestContext(tasks, basePlayer)
    expect(ctx.todayHardCount).toBe(1)
  })

  it('excludes clone XP from todayXp', () => {
    const tasks = [
      makeTask({ isClone: false }),
      makeTask({ isClone: true }),
    ]
    const ctx = buildQuestContext(tasks, basePlayer)
    expect(ctx.todayXp).toBe(100) // only the non-clone
  })

  it('sets dailyGoalMet correctly', () => {
    const tasks = Array.from({ length: 3 }, () => makeTask())
    const ctx = buildQuestContext(tasks, { ...basePlayer, dailyGoal: 3 })
    expect(ctx.dailyGoalMet).toBe(true)
  })

  it('dailyGoalMet false when under goal', () => {
    const tasks = [makeTask()]
    const ctx = buildQuestContext(tasks, { ...basePlayer, dailyGoal: 3 })
    expect(ctx.dailyGoalMet).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateQuest
// ---------------------------------------------------------------------------

const baseCtx = {
  todayDoneCount: 0,
  todayCloneCount: 0,
  todayHardCount: 0,
  todayXp: 0,
  combo: 1.0,
  streak: 0,
  dailyGoalMet: false,
}

describe('evaluateQuest – complete_tasks', () => {
  const q = { id: 'complete_3', type: 'complete_tasks', title: 'T', xpReward: 100, target: 3 }

  it('not completed at 0 tasks', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 0 })
    expect(res.completed).toBe(false)
    expect(res.current).toBe(0)
  })

  it('completed at exactly target', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 3 })
    expect(res.completed).toBe(true)
    expect(res.current).toBe(3)
  })

  it('current clamped to target when over', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 10 })
    expect(res.current).toBe(3)
    expect(res.completed).toBe(true)
  })
})

describe('evaluateQuest – hard_task', () => {
  const q = { id: 'hard_task', type: 'hard_task', title: 'T', xpReward: 100, target: 1 }

  it('not completed without hard tasks', () => {
    expect(evaluateQuest(q, { ...baseCtx, todayHardCount: 0 }).completed).toBe(false)
  })

  it('completed with 1 hard task', () => {
    expect(evaluateQuest(q, { ...baseCtx, todayHardCount: 1 }).completed).toBe(true)
  })
})

describe('evaluateQuest – no_clones', () => {
  const q = { id: 'no_clones', type: 'no_clones', title: 'T', xpReward: 75, target: 1 }

  it('not completed when no tasks done', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 0, todayCloneCount: 0 })
    expect(res.completed).toBe(false)
  })

  it('completed when tasks done with no clones', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 2, todayCloneCount: 0 })
    expect(res.completed).toBe(true)
  })

  it('not completed when any clone exists', () => {
    const res = evaluateQuest(q, { ...baseCtx, todayDoneCount: 3, todayCloneCount: 1 })
    expect(res.completed).toBe(false)
  })
})

describe('evaluateQuest – maintain_combo', () => {
  const q = { id: 'combo_12', type: 'maintain_combo', title: 'T', xpReward: 80, target: 1.2 }

  it('not completed at combo 1.0', () => {
    expect(evaluateQuest(q, { ...baseCtx, combo: 1.0 }).completed).toBe(false)
  })

  it('completed at exactly target combo', () => {
    expect(evaluateQuest(q, { ...baseCtx, combo: 1.2 }).completed).toBe(true)
  })

  it('completed above target combo', () => {
    expect(evaluateQuest(q, { ...baseCtx, combo: 1.4 }).completed).toBe(true)
  })
})

describe('evaluateQuest – daily_goal', () => {
  const q = { id: 'daily_goal', type: 'daily_goal', title: 'T', xpReward: 100, target: 1 }

  it('not completed when goal not met', () => {
    expect(evaluateQuest(q, { ...baseCtx, dailyGoalMet: false }).completed).toBe(false)
  })

  it('completed when goal met', () => {
    expect(evaluateQuest(q, { ...baseCtx, dailyGoalMet: true }).completed).toBe(true)
  })
})

describe('evaluateQuest – earn_xp', () => {
  const q = { id: 'earn_xp_200', type: 'earn_xp', title: 'T', xpReward: 80, target: 200 }

  it('not completed at 0 XP', () => {
    expect(evaluateQuest(q, { ...baseCtx, todayXp: 0 }).completed).toBe(false)
  })

  it('not completed at 199 XP', () => {
    expect(evaluateQuest(q, { ...baseCtx, todayXp: 199 }).completed).toBe(false)
  })

  it('completed at exactly 200 XP', () => {
    expect(evaluateQuest(q, { ...baseCtx, todayXp: 200 }).completed).toBe(true)
  })
})

describe('evaluateQuest – streak', () => {
  const q = { id: 'streak_active', type: 'streak', title: 'T', xpReward: 60, target: 1 }

  it('not completed at streak 0', () => {
    expect(evaluateQuest(q, { ...baseCtx, streak: 0 }).completed).toBe(false)
  })

  it('completed at streak 1', () => {
    expect(evaluateQuest(q, { ...baseCtx, streak: 1 }).completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateWeeklyChallenge
// ---------------------------------------------------------------------------

describe('evaluateWeeklyChallenge', () => {
  it('returns zero progress with no tasks', () => {
    const res = evaluateWeeklyChallenge([])
    expect(res.tasksCount).toBe(0)
    expect(res.xpEarned).toBe(0)
    expect(res.completed).toBe(false)
  })

  it('counts only done tasks', () => {
    const tasks = [
      { status: 'done', isClone: false },
      { status: 'pending', isClone: false },
    ]
    expect(evaluateWeeklyChallenge(tasks).tasksCount).toBe(1)
  })

  it('excludes clone XP', () => {
    const tasks = [
      { status: 'done', isClone: false },
      { status: 'done', isClone: true },
    ]
    expect(evaluateWeeklyChallenge(tasks).xpEarned).toBe(100)
  })

  it(`completes when tasks >= ${WEEKLY_TASK_TARGET}`, () => {
    const tasks = Array.from({ length: WEEKLY_TASK_TARGET }, () => ({
      status: 'done',
      isClone: false,
    }))
    expect(evaluateWeeklyChallenge(tasks).completed).toBe(true)
  })

  it(`completes when xp >= ${WEEKLY_XP_TARGET}`, () => {
    // 20 tasks × 100 XP = 2000 XP (meeting the XP target even with fewer tasks)
    const tasks = Array.from({ length: WEEKLY_XP_TARGET / 100 }, () => ({
      status: 'done',
      isClone: false,
    }))
    expect(evaluateWeeklyChallenge(tasks).completed).toBe(true)
  })

  it('not completed with 19 non-clone tasks and 1900 XP', () => {
    const tasks = Array.from({ length: 19 }, () => ({ status: 'done', isClone: false }))
    const res = evaluateWeeklyChallenge(tasks)
    expect(res.completed).toBe(false)
  })

  it('resets: fresh week = 0 tasks', () => {
    // A "reset" means calling with an empty array (new week, no tasks yet)
    const res = evaluateWeeklyChallenge([])
    expect(res.tasksCount).toBe(0)
    expect(res.completed).toBe(false)
  })
})
