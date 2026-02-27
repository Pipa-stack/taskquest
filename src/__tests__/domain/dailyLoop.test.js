import { describe, it, expect } from 'vitest'
import {
  getDailyLoopStatus,
  isDailyLoopClaimed,
  applyDailyLoopReward,
  DAILY_LOOP_REWARD,
} from '../../domain/dailyLoop.js'

const TODAY = '2026-02-27'
const YESTERDAY = '2026-02-26'

// ── DAILY_LOOP_REWARD ─────────────────────────────────────────────────────────

describe('DAILY_LOOP_REWARD', () => {
  it('awards 50 coins', () => {
    expect(DAILY_LOOP_REWARD.coins).toBe(50)
  })

  it('awards 10 essence', () => {
    expect(DAILY_LOOP_REWARD.essence).toBe(10)
  })
})

// ── getDailyLoopStatus ────────────────────────────────────────────────────────

describe('getDailyLoopStatus', () => {
  const basePlayer = {
    dailyGoal: 3,
    lastIdleClaimDate: null,
    lastGachaPullDate: null,
  }

  it('returns all false when nothing is done', () => {
    const status = getDailyLoopStatus(basePlayer, 0, TODAY)
    expect(status.goalMet).toBe(false)
    expect(status.idleClaimed).toBe(false)
    expect(status.gachaPulled).toBe(false)
    expect(status.allDone).toBe(false)
  })

  it('goalMet is true when todayDone >= dailyGoal', () => {
    const status = getDailyLoopStatus(basePlayer, 3, TODAY)
    expect(status.goalMet).toBe(true)
  })

  it('goalMet is true when todayDone exceeds dailyGoal', () => {
    const status = getDailyLoopStatus(basePlayer, 5, TODAY)
    expect(status.goalMet).toBe(true)
  })

  it('goalMet is false when todayDone is one short', () => {
    const status = getDailyLoopStatus(basePlayer, 2, TODAY)
    expect(status.goalMet).toBe(false)
  })

  it('defaults dailyGoal to 3 when missing', () => {
    const player = { ...basePlayer, dailyGoal: undefined }
    const status = getDailyLoopStatus(player, 3, TODAY)
    expect(status.goalMet).toBe(true)
  })

  it('idleClaimed is true when lastIdleClaimDate === today', () => {
    const player = { ...basePlayer, lastIdleClaimDate: TODAY }
    const status = getDailyLoopStatus(player, 0, TODAY)
    expect(status.idleClaimed).toBe(true)
  })

  it('idleClaimed is false when lastIdleClaimDate is yesterday', () => {
    const player = { ...basePlayer, lastIdleClaimDate: YESTERDAY }
    const status = getDailyLoopStatus(player, 0, TODAY)
    expect(status.idleClaimed).toBe(false)
  })

  it('gachaPulled is true when lastGachaPullDate === today', () => {
    const player = { ...basePlayer, lastGachaPullDate: TODAY }
    const status = getDailyLoopStatus(player, 0, TODAY)
    expect(status.gachaPulled).toBe(true)
  })

  it('gachaPulled is false when lastGachaPullDate is yesterday', () => {
    const player = { ...basePlayer, lastGachaPullDate: YESTERDAY }
    const status = getDailyLoopStatus(player, 0, TODAY)
    expect(status.gachaPulled).toBe(false)
  })

  it('allDone is true only when all 3 conditions are met', () => {
    const player = {
      dailyGoal: 1,
      lastIdleClaimDate: TODAY,
      lastGachaPullDate: TODAY,
    }
    const status = getDailyLoopStatus(player, 1, TODAY)
    expect(status.allDone).toBe(true)
  })

  it('allDone is false if only 2 of 3 conditions are met', () => {
    const player = {
      dailyGoal: 1,
      lastIdleClaimDate: TODAY,
      lastGachaPullDate: null,
    }
    const status = getDailyLoopStatus(player, 1, TODAY)
    expect(status.allDone).toBe(false)
  })

  it('returns a flat object with exactly the four boolean fields', () => {
    const status = getDailyLoopStatus(basePlayer, 0, TODAY)
    expect(typeof status.goalMet).toBe('boolean')
    expect(typeof status.idleClaimed).toBe('boolean')
    expect(typeof status.gachaPulled).toBe('boolean')
    expect(typeof status.allDone).toBe('boolean')
  })
})

// ── isDailyLoopClaimed ────────────────────────────────────────────────────────

describe('isDailyLoopClaimed', () => {
  it('returns true when dailyLoopClaimedDate === today', () => {
    expect(isDailyLoopClaimed({ dailyLoopClaimedDate: TODAY }, TODAY)).toBe(true)
  })

  it('returns false when dailyLoopClaimedDate is yesterday', () => {
    expect(isDailyLoopClaimed({ dailyLoopClaimedDate: YESTERDAY }, TODAY)).toBe(false)
  })

  it('returns false when dailyLoopClaimedDate is null', () => {
    expect(isDailyLoopClaimed({ dailyLoopClaimedDate: null }, TODAY)).toBe(false)
  })

  it('returns false when field is missing', () => {
    expect(isDailyLoopClaimed({}, TODAY)).toBe(false)
  })
})

// ── applyDailyLoopReward ──────────────────────────────────────────────────────

describe('applyDailyLoopReward', () => {
  it('adds 50 coins to player', () => {
    const player = { coins: 100, essence: 5, dailyLoopClaimedDate: null }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.coins).toBe(150)
  })

  it('adds 10 essence to player', () => {
    const player = { coins: 0, essence: 5, dailyLoopClaimedDate: null }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.essence).toBe(15)
  })

  it('sets dailyLoopClaimedDate to today', () => {
    const player = { coins: 0, essence: 0, dailyLoopClaimedDate: null }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.dailyLoopClaimedDate).toBe(TODAY)
  })

  it('defaults coins to 0 when missing', () => {
    const player = { essence: 0 }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.coins).toBe(50)
  })

  it('defaults essence to 0 when missing', () => {
    const player = { coins: 0 }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.essence).toBe(10)
  })

  it('does not mutate the original player object', () => {
    const player = { coins: 100, essence: 5, dailyLoopClaimedDate: null }
    applyDailyLoopReward(player, TODAY)
    expect(player.coins).toBe(100)
    expect(player.essence).toBe(5)
    expect(player.dailyLoopClaimedDate).toBe(null)
  })

  it('preserves other player fields', () => {
    const player = { coins: 0, essence: 0, xp: 999, streak: 7 }
    const result = applyDailyLoopReward(player, TODAY)
    expect(result.xp).toBe(999)
    expect(result.streak).toBe(7)
  })
})
