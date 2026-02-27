import { describe, it, expect } from 'vitest'
import {
  isDailyLoopComplete,
  hasDailyLoopClaimed,
  applyDailyLoopReward,
  getDailyLoopStatus,
  DAILY_LOOP_REWARD,
} from '../../domain/dailyLoop.js'

const TODAY = '2024-06-15'
const OTHER_DAY = '2024-06-14'

// ── isDailyLoopComplete ──────────────────────────────────────────────────────

describe('isDailyLoopComplete', () => {
  it('returns false when no conditions are met', () => {
    expect(isDailyLoopComplete({
      todayDone: 0, dailyGoal: 3,
      lastIdleClaimDate: null, lastGachaPullDate: null, today: TODAY,
    })).toBe(false)
  })

  it('returns false when only goal is met', () => {
    expect(isDailyLoopComplete({
      todayDone: 3, dailyGoal: 3,
      lastIdleClaimDate: null, lastGachaPullDate: null, today: TODAY,
    })).toBe(false)
  })

  it('returns false when goal + idle met but no gacha pull', () => {
    expect(isDailyLoopComplete({
      todayDone: 3, dailyGoal: 3,
      lastIdleClaimDate: TODAY, lastGachaPullDate: null, today: TODAY,
    })).toBe(false)
  })

  it('returns false when goal + gacha met but no idle claim', () => {
    expect(isDailyLoopComplete({
      todayDone: 5, dailyGoal: 3,
      lastIdleClaimDate: null, lastGachaPullDate: TODAY, today: TODAY,
    })).toBe(false)
  })

  it('returns false when idle + gacha met but goal not reached', () => {
    expect(isDailyLoopComplete({
      todayDone: 1, dailyGoal: 3,
      lastIdleClaimDate: TODAY, lastGachaPullDate: TODAY, today: TODAY,
    })).toBe(false)
  })

  it('returns true when all three conditions are met', () => {
    expect(isDailyLoopComplete({
      todayDone: 3, dailyGoal: 3,
      lastIdleClaimDate: TODAY, lastGachaPullDate: TODAY, today: TODAY,
    })).toBe(true)
  })

  it('returns true when tasks done exceeds daily goal', () => {
    expect(isDailyLoopComplete({
      todayDone: 10, dailyGoal: 3,
      lastIdleClaimDate: TODAY, lastGachaPullDate: TODAY, today: TODAY,
    })).toBe(true)
  })

  it('returns false when idle and gacha dates are from yesterday', () => {
    expect(isDailyLoopComplete({
      todayDone: 5, dailyGoal: 3,
      lastIdleClaimDate: OTHER_DAY, lastGachaPullDate: OTHER_DAY, today: TODAY,
    })).toBe(false)
  })
})

// ── hasDailyLoopClaimed ──────────────────────────────────────────────────────

describe('hasDailyLoopClaimed', () => {
  it('returns false for a player with no claimedDate', () => {
    expect(hasDailyLoopClaimed({ dailyLoopClaimedDate: null }, TODAY)).toBe(false)
  })

  it('returns false when claimedDate is a different day', () => {
    expect(hasDailyLoopClaimed({ dailyLoopClaimedDate: OTHER_DAY }, TODAY)).toBe(false)
  })

  it('returns true when claimedDate matches today', () => {
    expect(hasDailyLoopClaimed({ dailyLoopClaimedDate: TODAY }, TODAY)).toBe(true)
  })

  it('returns false for player with undefined claimedDate', () => {
    expect(hasDailyLoopClaimed({}, TODAY)).toBe(false)
  })
})

// ── applyDailyLoopReward ─────────────────────────────────────────────────────

describe('applyDailyLoopReward', () => {
  it('adds DAILY_LOOP_REWARD coins to player coins', () => {
    const player = { coins: 100, essence: 0 }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.coins).toBe(100 + DAILY_LOOP_REWARD.coins)
  })

  it('adds DAILY_LOOP_REWARD essence to player essence', () => {
    const player = { coins: 0, essence: 5 }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.essence).toBe(5 + DAILY_LOOP_REWARD.essence)
  })

  it('sets dailyLoopClaimedDate to today', () => {
    const player = { coins: 0, essence: 0, dailyLoopClaimedDate: null }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.dailyLoopClaimedDate).toBe(TODAY)
  })

  it('does not mutate the original player object', () => {
    const player = { coins: 50, essence: 0 }
    applyDailyLoopReward(player, TODAY)
    expect(player.coins).toBe(50)
    expect(player.dailyLoopClaimedDate).toBeUndefined()
  })

  it('handles player with undefined coins/essence gracefully', () => {
    const player = {}
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.coins).toBe(DAILY_LOOP_REWARD.coins)
    expect(result.essence).toBe(DAILY_LOOP_REWARD.essence)
  })
})

// ── getDailyLoopStatus ───────────────────────────────────────────────────────

describe('getDailyLoopStatus', () => {
  it('returns all false when nothing done', () => {
    const status = getDailyLoopStatus({
      todayDone: 0, dailyGoal: 3,
      lastIdleClaimDate: null, lastGachaPullDate: null, today: TODAY,
    })
    expect(status).toEqual({ goalMet: false, idleMet: false, gachaMet: false, allDone: false })
  })

  it('returns goalMet=true when tasks >= dailyGoal', () => {
    const status = getDailyLoopStatus({
      todayDone: 4, dailyGoal: 3,
      lastIdleClaimDate: null, lastGachaPullDate: null, today: TODAY,
    })
    expect(status.goalMet).toBe(true)
    expect(status.allDone).toBe(false)
  })

  it('returns allDone=true when all conditions met', () => {
    const status = getDailyLoopStatus({
      todayDone: 3, dailyGoal: 3,
      lastIdleClaimDate: TODAY, lastGachaPullDate: TODAY, today: TODAY,
    })
    expect(status.allDone).toBe(true)
  })
})

// ── DAILY_LOOP_REWARD constant ───────────────────────────────────────────────

describe('DAILY_LOOP_REWARD', () => {
  it('has positive coins reward', () => {
    expect(DAILY_LOOP_REWARD.coins).toBeGreaterThan(0)
  })

  it('has positive essence reward', () => {
    expect(DAILY_LOOP_REWARD.essence).toBeGreaterThan(0)
  })
})
