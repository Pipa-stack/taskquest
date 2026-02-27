import { describe, it, expect } from 'vitest'
import {
  getZoneQuests,
  getQuest,
  computeQuestProgress,
  claimQuestReward,
} from '../../domain/zoneQuests.js'

// ---------------------------------------------------------------------------
// getZoneQuests
// ---------------------------------------------------------------------------
describe('getZoneQuests', () => {
  it('returns 5 quests for each zone 1–6', () => {
    for (let z = 1; z <= 6; z++) {
      expect(getZoneQuests(z)).toHaveLength(5)
    }
  })

  it('returns [] for an unknown zone', () => {
    expect(getZoneQuests(0)).toEqual([])
    expect(getZoneQuests(99)).toEqual([])
  })

  it('quest ids are unique within a zone', () => {
    for (let z = 1; z <= 6; z++) {
      const ids = getZoneQuests(z).map((q) => q.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('each quest has required fields', () => {
    for (let z = 1; z <= 6; z++) {
      for (const quest of getZoneQuests(z)) {
        expect(quest).toHaveProperty('id')
        expect(quest).toHaveProperty('label')
        expect(quest).toHaveProperty('type')
        expect(quest).toHaveProperty('target')
        expect(quest.reward).toHaveProperty('coins')
        expect(quest.reward.coins).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// getQuest
// ---------------------------------------------------------------------------
describe('getQuest', () => {
  it('finds a quest by id across all zones', () => {
    const q = getQuest('z1_q1')
    expect(q).toBeDefined()
    expect(q.id).toBe('z1_q1')
  })

  it('returns undefined for an unknown quest id', () => {
    expect(getQuest('nonexistent')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeQuestProgress
// ---------------------------------------------------------------------------
describe('computeQuestProgress', () => {
  const basePlayer = {
    xp: 0,
    coins: 0,
    streak: 0,
    unlockedCharacters: [],
  }

  it('tasks_count type uses tasksCompleted from stats', () => {
    const quest = { type: 'tasks_count', target: 5 }
    expect(computeQuestProgress(quest, { player: basePlayer, tasksCompleted: 3 })).toEqual({
      current: 3,
      target: 5,
      completed: false,
    })
    expect(computeQuestProgress(quest, { player: basePlayer, tasksCompleted: 5 })).toEqual({
      current: 5,
      target: 5,
      completed: true,
    })
    expect(computeQuestProgress(quest, { player: basePlayer, tasksCompleted: 10 })).toEqual({
      current: 5, // capped at target
      target: 5,
      completed: true,
    })
  })

  it('coins_total type uses player.coins', () => {
    const quest = { type: 'coins_total', target: 100 }
    expect(computeQuestProgress(quest, { player: { ...basePlayer, coins: 60 } })).toEqual({
      current: 60,
      target: 100,
      completed: false,
    })
    expect(computeQuestProgress(quest, { player: { ...basePlayer, coins: 200 } })).toEqual({
      current: 100,
      target: 100,
      completed: true,
    })
  })

  it('characters_unlocked type uses unlockedCharacters.length', () => {
    const quest = { type: 'characters_unlocked', target: 2 }
    expect(
      computeQuestProgress(quest, { player: { ...basePlayer, unlockedCharacters: ['warrior'] } })
    ).toEqual({ current: 1, target: 2, completed: false })
    expect(
      computeQuestProgress(quest, {
        player: { ...basePlayer, unlockedCharacters: ['warrior', 'mage'] },
      })
    ).toEqual({ current: 2, target: 2, completed: true })
  })

  it('streak type uses player.streak', () => {
    const quest = { type: 'streak', target: 3 }
    expect(computeQuestProgress(quest, { player: { ...basePlayer, streak: 2 } })).toEqual({
      current: 2,
      target: 3,
      completed: false,
    })
    expect(computeQuestProgress(quest, { player: { ...basePlayer, streak: 3 } })).toEqual({
      current: 3,
      target: 3,
      completed: true,
    })
  })

  it('level type derives level from player.xp', () => {
    // xpToLevel: floor(xp/500)+1; level 2 requires xp >= 500
    const quest = { type: 'level', target: 2 }
    expect(computeQuestProgress(quest, { player: { ...basePlayer, xp: 400 } })).toEqual({
      current: 1,
      target: 2,
      completed: false,
    })
    expect(computeQuestProgress(quest, { player: { ...basePlayer, xp: 500 } })).toEqual({
      current: 2,
      target: 2,
      completed: true,
    })
  })

  it('unknown type returns current=0, not completed', () => {
    const quest = { type: 'unknown_type', target: 5 }
    expect(computeQuestProgress(quest, { player: basePlayer })).toEqual({
      current: 0,
      target: 5,
      completed: false,
    })
  })

  it('defaults tasksCompleted to 0 when not provided', () => {
    const quest = { type: 'tasks_count', target: 3 }
    expect(computeQuestProgress(quest, { player: basePlayer })).toEqual({
      current: 0,
      target: 3,
      completed: false,
    })
  })
})

// ---------------------------------------------------------------------------
// claimQuestReward
// ---------------------------------------------------------------------------
describe('claimQuestReward', () => {
  it('returns a copy of the quest reward', () => {
    const quest = { id: 'z1_q1', label: 'Test', type: 'streak', target: 2, reward: { coins: 40 } }
    const reward = claimQuestReward(quest)
    expect(reward).toEqual({ coins: 40 })
  })

  it('returned reward is a new object (not the same reference)', () => {
    const quest = { reward: { coins: 60 } }
    const reward = claimQuestReward(quest)
    expect(reward).not.toBe(quest.reward)
  })

  it('works for every quest in every zone', () => {
    for (let z = 1; z <= 6; z++) {
      for (const quest of getZoneQuests(z)) {
        const reward = claimQuestReward(quest)
        expect(typeof reward.coins).toBe('number')
        expect(reward.coins).toBeGreaterThan(0)
      }
    }
  })
})
