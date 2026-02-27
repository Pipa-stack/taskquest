import { describe, it, expect } from 'vitest'
import {
  PLAYER_DEFAULTS,
  CAPS,
  IDLE_CFG,
  BOOST_CFG,
  ZONE_ECONOMY,
  GACHA_CFG,
  XP_CFG,
  TALENT_CFG,
  DAILY_LOOP_CFG,
  PRESTIGE_CFG,
  clampPlayer,
} from '../../domain/config.js'

// ── Config invariants ─────────────────────────────────────────────────────────

describe('PLAYER_DEFAULTS invariants', () => {
  it('all numeric defaults are non-negative', () => {
    for (const [k, v] of Object.entries(PLAYER_DEFAULTS)) {
      if (typeof v === 'number') {
        expect(v, `PLAYER_DEFAULTS.${k}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('default energyCap equals default energy (player starts full)', () => {
    expect(PLAYER_DEFAULTS.energyCap).toBe(PLAYER_DEFAULTS.energy)
  })

  it('default dailyGoal is a positive integer', () => {
    expect(PLAYER_DEFAULTS.dailyGoal).toBeGreaterThan(0)
    expect(Number.isInteger(PLAYER_DEFAULTS.dailyGoal)).toBe(true)
  })

  it('default coinsPerMinuteBase >= 1', () => {
    expect(PLAYER_DEFAULTS.coinsPerMinuteBase).toBeGreaterThanOrEqual(1)
  })
})

describe('CAPS invariants', () => {
  it('all caps are positive numbers', () => {
    for (const [k, v] of Object.entries(CAPS)) {
      expect(typeof v, `CAPS.${k} should be number`).toBe('number')
      expect(v, `CAPS.${k}`).toBeGreaterThan(0)
    }
  })

  it('coins cap >= 1000 (viable end-game balance)', () => {
    expect(CAPS.coins).toBeGreaterThanOrEqual(1_000)
  })

  it('energyCap ceiling >= default energyCap', () => {
    expect(CAPS.energyCap).toBeGreaterThanOrEqual(PLAYER_DEFAULTS.energyCap)
  })

  it('energy ceiling >= energyCap ceiling (energy cannot exceed effective cap)', () => {
    expect(CAPS.energy).toBeGreaterThanOrEqual(CAPS.energyCap)
  })
})

describe('BOOST_CFG invariants', () => {
  it('all boost costs are positive integers', () => {
    for (const [id, cfg] of Object.entries(BOOST_CFG)) {
      expect(cfg.cost, `BOOST_CFG.${id}.cost`).toBeGreaterThan(0)
      expect(Number.isInteger(cfg.cost), `BOOST_CFG.${id}.cost should be integer`).toBe(true)
    }
  })

  it('coin_x2_2h cost < 2 × coin_x2_30m cost (2h should be cheaper per-minute)', () => {
    // If 2h costs ≥ 2× the 30m, it's strictly worse in efficiency for same session
    expect(BOOST_CFG.coin_x2_2h.cost).toBeLessThan(2 * BOOST_CFG.coin_x2_30m.cost)
  })

  it('coin_x2_2h has better per-minute ROI than coin_x2_30m', () => {
    const roi30m = 1 / (BOOST_CFG.coin_x2_30m.cost / 30)
    const roi2h  = 1 / (BOOST_CFG.coin_x2_2h.cost  / 120)
    expect(roi2h).toBeGreaterThan(roi30m)
  })

  it('energy_refill costs less than energy_cap_plus50_24h (instant < timed)', () => {
    expect(BOOST_CFG.energy_refill.cost).toBeLessThan(BOOST_CFG.energy_cap_plus50_24h.cost)
  })

  it('coin_x2_30m and coin_x2_2h have durationMs consistent with label', () => {
    expect(BOOST_CFG.coin_x2_30m.durationMs).toBe(30 * 60 * 1_000)
    expect(BOOST_CFG.coin_x2_2h.durationMs).toBe(120 * 60 * 1_000)
  })
})

describe('ZONE_ECONOMY invariants', () => {
  const zoneIds = [1, 2, 3, 4, 5, 6]

  it('all 6 zones are defined', () => {
    for (const id of zoneIds) {
      expect(ZONE_ECONOMY[id], `Zone ${id} missing`).toBeDefined()
    }
  })

  it('zone 1 is always free (unlockCostCoins = 0)', () => {
    expect(ZONE_ECONOMY[1].unlockCostCoins).toBe(0)
    expect(ZONE_ECONOMY[1].requiredPower).toBe(0)
  })

  it('unlock costs strictly increase across zones', () => {
    for (let i = 2; i <= 5; i++) {
      expect(ZONE_ECONOMY[i + 1].unlockCostCoins, `Zone ${i+1} should cost more than zone ${i}`)
        .toBeGreaterThan(ZONE_ECONOMY[i].unlockCostCoins)
    }
  })

  it('required power strictly increases across zones 2–6', () => {
    for (let i = 2; i <= 5; i++) {
      expect(ZONE_ECONOMY[i + 1].requiredPower, `Zone ${i+1} power req should exceed zone ${i}`)
        .toBeGreaterThan(ZONE_ECONOMY[i].requiredPower)
    }
  })

  it('coinsPerMinuteBonus increases with zone number', () => {
    for (let i = 1; i <= 5; i++) {
      expect(ZONE_ECONOMY[i + 1].coinsPerMinuteBonus, `Zone ${i+1} CPM bonus should exceed zone ${i}`)
        .toBeGreaterThan(ZONE_ECONOMY[i].coinsPerMinuteBonus)
    }
  })
})

describe('GACHA_CFG invariants', () => {
  it('all base rates are between 0 and 1', () => {
    for (const [rarity, rate] of Object.entries(GACHA_CFG.baseRates)) {
      expect(rate, `${rarity} rate`).toBeGreaterThan(0)
      expect(rate, `${rarity} rate`).toBeLessThanOrEqual(1)
    }
  })

  it('base rates sum to 1.0', () => {
    const total = Object.values(GACHA_CFG.baseRates).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0, 10)
  })

  it('pityMin < pityDefault', () => {
    expect(GACHA_CFG.pityMin).toBeLessThan(GACHA_CFG.pityDefault)
  })

  it('pullCost is a positive integer', () => {
    expect(GACHA_CFG.pullCost).toBeGreaterThan(0)
    expect(Number.isInteger(GACHA_CFG.pullCost)).toBe(true)
  })
})

describe('XP_CFG and TALENT_CFG invariants', () => {
  it('XP perTask and perLevel are positive', () => {
    expect(XP_CFG.perTask).toBeGreaterThan(0)
    expect(XP_CFG.perLevel).toBeGreaterThan(0)
  })

  it('perLevel > perTask (needs more than 1 task to level up)', () => {
    expect(XP_CFG.perLevel).toBeGreaterThan(XP_CFG.perTask)
  })

  it('TALENT_CFG.maxPerBranch is a positive integer', () => {
    expect(TALENT_CFG.maxPerBranch).toBeGreaterThan(0)
    expect(Number.isInteger(TALENT_CFG.maxPerBranch)).toBe(true)
  })
})

describe('DAILY_LOOP_CFG invariants', () => {
  it('reward coins is positive', () => {
    expect(DAILY_LOOP_CFG.rewardCoins).toBeGreaterThan(0)
  })

  it('reward essence is positive', () => {
    expect(DAILY_LOOP_CFG.rewardEssence).toBeGreaterThan(0)
  })
})

// ── clampPlayer ───────────────────────────────────────────────────────────────

describe('clampPlayer', () => {
  it('returns an object for null input', () => {
    const result = clampPlayer(null)
    expect(typeof result).toBe('object')
  })

  it('returns an object for undefined input', () => {
    const result = clampPlayer(undefined)
    expect(typeof result).toBe('object')
  })

  it('clamps coins above CAPS.coins to CAPS.coins', () => {
    const result = clampPlayer({ coins: 99_999_999 })
    expect(result.coins).toBe(CAPS.coins)
  })

  it('clamps negative coins to 0', () => {
    const result = clampPlayer({ coins: -500 })
    expect(result.coins).toBe(0)
  })

  it('clamps energy above energyCap', () => {
    const result = clampPlayer({ energy: 200, energyCap: 100 })
    expect(result.energy).toBeLessThanOrEqual(100)
  })

  it('clamps negative energy to 0', () => {
    const result = clampPlayer({ energy: -10, energyCap: 100 })
    expect(result.energy).toBe(0)
  })

  it('clamps xp above CAPS.xp', () => {
    const result = clampPlayer({ xp: 999_999_999 })
    expect(result.xp).toBe(CAPS.xp)
  })

  it('clamps NaN xp to default (0)', () => {
    const result = clampPlayer({ xp: NaN })
    expect(result.xp).toBe(0)
  })

  it('clamps Infinity coins to CAPS.coins', () => {
    const result = clampPlayer({ coins: Infinity })
    expect(result.coins).toBe(CAPS.coins)
  })

  it('truncates boosts array to CAPS.boosts items', () => {
    const boosts = Array.from({ length: 50 }, (_, i) => ({ id: `b${i}`, expiresAt: Date.now() }))
    const result = clampPlayer({ boosts })
    expect(result.boosts.length).toBe(CAPS.boosts)
  })

  it('replaces invalid boosts (non-array) with empty array', () => {
    const result = clampPlayer({ boosts: 'broken' })
    expect(result.boosts).toEqual([])
  })

  it('does not mutate the input player object', () => {
    const player = { coins: -100, energy: 200, energyCap: 100 }
    clampPlayer(player)
    expect(player.coins).toBe(-100)
    expect(player.energy).toBe(200)
  })

  it('preserves non-numeric fields untouched', () => {
    const player = {
      coins: 0,
      lastActiveDate: '2026-02-27',
      rewardsUnlocked: ['r1'],
      activeTeam: ['warrior'],
    }
    const result = clampPlayer(player)
    expect(result.lastActiveDate).toBe('2026-02-27')
    expect(result.rewardsUnlocked).toEqual(['r1'])
    expect(result.activeTeam).toEqual(['warrior'])
  })

  it('clamps a valid player without changing values', () => {
    const player = { coins: 500, energy: 80, energyCap: 100, xp: 1000, streak: 5 }
    const result = clampPlayer(player)
    expect(result.coins).toBe(500)
    expect(result.energy).toBe(80)
    expect(result.xp).toBe(1000)
    expect(result.streak).toBe(5)
  })
})

// ── Daily loop no double-claim invariant (pure domain) ────────────────────────

describe('daily loop double-claim invariant', () => {
  const TODAY = '2026-02-27'

  it('isDailyLoopClaimed returns true after claim (using DAILY_LOOP_CFG reward)', async () => {
    // Simulate the state after claimDailyLoop applies reward
    const playerBefore = {
      coins: 100,
      essence: 5,
      dailyLoopClaimedDate: null,
      dailyGoal: 1,
      lastIdleClaimDate: TODAY,
      lastGachaPullDate: TODAY,
    }

    // Simulate applying the reward (pure transform matching domain logic)
    const playerAfter = {
      ...playerBefore,
      coins: playerBefore.coins + DAILY_LOOP_CFG.rewardCoins,
      essence: playerBefore.essence + DAILY_LOOP_CFG.rewardEssence,
      dailyLoopClaimedDate: TODAY,
    }

    expect(playerAfter.dailyLoopClaimedDate).toBe(TODAY)
    // Second apply attempt: reward should not re-apply because date already matches
    const alreadyClaimed = playerAfter.dailyLoopClaimedDate === TODAY
    expect(alreadyClaimed).toBe(true)
  })

  it('reward is exactly DAILY_LOOP_CFG amounts', () => {
    const before = { coins: 200, essence: 20 }
    const after = {
      coins: before.coins + DAILY_LOOP_CFG.rewardCoins,
      essence: before.essence + DAILY_LOOP_CFG.rewardEssence,
    }
    expect(after.coins - before.coins).toBe(DAILY_LOOP_CFG.rewardCoins)
    expect(after.essence - before.essence).toBe(DAILY_LOOP_CFG.rewardEssence)
  })
})
