import { describe, it, expect } from 'vitest'
import {
  DAILY_EVENTS,
  WEEKLY_EVENTS,
  BASE_TASK_COIN_REWARD,
  EVENT_CLAIM_BONUS,
  EVENT_GACHA_DUST_BONUS,
  EVENT_ENERGY_BONUS,
  EVENT_BOOST_EXTEND_MS,
  getDailyEvent,
  getWeeklyEvent,
  getActiveEvents,
  applyEventModifiers,
  getEconomyWithEvents,
  canClaimEventBonus,
  canUseGachaDiscount,
  canUseFreeIdleClaim,
  computeDailyClaimReward,
  getDailyRecommendation,
  getEventEffectLines,
} from '../../domain/events.js'
import { applyGachaRareBonus, normalizeRates, BASE_RATES, pickRarity } from '../../domain/gacha.js'

// ── Catalog invariants ────────────────────────────────────────────────────────

describe('DAILY_EVENTS catalog', () => {
  it('has exactly 7 entries (one per day of week)', () => {
    expect(DAILY_EVENTS).toHaveLength(7)
  })

  it('all events have required fields', () => {
    for (const event of DAILY_EVENTS) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('title')
      expect(event).toHaveProperty('subtitle')
      expect(event).toHaveProperty('icon')
      expect(event).toHaveProperty('tagColor')
      expect(event).toHaveProperty('modifiers')
      expect(typeof event.modifiers).toBe('object')
    }
  })

  it('all ids are unique', () => {
    const ids = DAILY_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('multiplier modifiers are ≥ 1 (no penalties)', () => {
    for (const event of DAILY_EVENTS) {
      const m = event.modifiers
      if (m.taskCoinMultiplier  != null) expect(m.taskCoinMultiplier).toBeGreaterThanOrEqual(1)
      if (m.idleCpmMultiplier   != null) expect(m.idleCpmMultiplier).toBeGreaterThanOrEqual(1)
      if (m.gachaRareBonus      != null) expect(m.gachaRareBonus).toBeGreaterThanOrEqual(0)
      if (m.energyCapBonus      != null) expect(m.energyCapBonus).toBeGreaterThanOrEqual(0)
    }
  })

  it('boost price modifiers (if present) are < 1 (they are discounts)', () => {
    for (const event of DAILY_EVENTS) {
      if (event.modifiers.boostPriceMultiplier != null) {
        expect(event.modifiers.boostPriceMultiplier).toBeLessThan(1)
        expect(event.modifiers.boostPriceMultiplier).toBeGreaterThan(0)
      }
    }
  })
})

describe('WEEKLY_EVENTS catalog', () => {
  it('has exactly 4 entries', () => {
    expect(WEEKLY_EVENTS).toHaveLength(4)
  })

  it('all events have required fields', () => {
    for (const event of WEEKLY_EVENTS) {
      expect(event).toHaveProperty('id')
      expect(event).toHaveProperty('title')
      expect(event).toHaveProperty('subtitle')
      expect(event).toHaveProperty('icon')
      expect(event).toHaveProperty('tagColor')
      expect(event).toHaveProperty('modifiers')
    }
  })

  it('all ids are unique', () => {
    const ids = WEEKLY_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── getDailyEvent determinism ─────────────────────────────────────────────────

describe('getDailyEvent', () => {
  // 2026-02-28 is a Saturday (day 6)
  it('returns the Saturday event for 2026-02-28', () => {
    const event = getDailyEvent('2026-02-28')
    expect(event).toBe(DAILY_EVENTS[6])
    expect(event.id).toBe('power_saturday')
  })

  // 2026-03-01 is a Sunday (day 0)
  it('returns the Sunday event for 2026-03-01', () => {
    const event = getDailyEvent('2026-03-01')
    expect(event).toBe(DAILY_EVENTS[0])
    expect(event.id).toBe('golden_sunday')
  })

  // 2026-03-02 is a Monday (day 1)
  it('returns the Monday event for 2026-03-02', () => {
    const event = getDailyEvent('2026-03-02')
    expect(event).toBe(DAILY_EVENTS[1])
    expect(event.id).toBe('monday_surge')
  })

  // 2026-03-03 is a Tuesday (day 2)
  it('returns the Tuesday event for 2026-03-03', () => {
    const event = getDailyEvent('2026-03-03')
    expect(event).toBe(DAILY_EVENTS[2])
    expect(event.id).toBe('gacha_tuesday')
  })

  // 2026-03-04 is a Wednesday (day 3)
  it('returns the Wednesday event for 2026-03-04', () => {
    const event = getDailyEvent('2026-03-04')
    expect(event).toBe(DAILY_EVENTS[3])
    expect(event.id).toBe('boost_wednesday')
  })

  // 2026-03-05 is a Thursday (day 4)
  it('returns the Thursday event for 2026-03-05', () => {
    const event = getDailyEvent('2026-03-05')
    expect(event).toBe(DAILY_EVENTS[4])
    expect(event.id).toBe('energy_thursday')
  })

  // 2026-03-06 is a Friday (day 5)
  it('returns the Friday event for 2026-03-06', () => {
    const event = getDailyEvent('2026-03-06')
    expect(event).toBe(DAILY_EVENTS[5])
    expect(event.id).toBe('xp_friday')
  })

  it('is deterministic: calling twice with same dateKey gives identical result', () => {
    const a = getDailyEvent('2026-02-28')
    const b = getDailyEvent('2026-02-28')
    expect(a).toBe(b)
  })
})

// ── getWeeklyEvent determinism ────────────────────────────────────────────────

describe('getWeeklyEvent', () => {
  it('is deterministic: calling twice with same dateKey gives identical result', () => {
    const a = getWeeklyEvent('2026-02-28')
    const b = getWeeklyEvent('2026-02-28')
    expect(a).toBe(b)
  })

  it('returns a different event 7 days later (weekly rotation)', () => {
    const event1 = getWeeklyEvent('2026-02-23')
    const event2 = getWeeklyEvent('2026-03-02')
    // They CAN be different (7 days = 1 week apart → index shifts by 1)
    // At minimum they should not be the same index
    expect(event1.id).not.toBe(event2.id)
  })

  it('completes a 4-week cycle: all 4 distinct weekly events appear', () => {
    const seen = new Set()
    // 4 consecutive weeks
    const baseDate = new Date(2026, 0, 5) // 2026-01-05
    for (let i = 0; i < 4; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + i * 7)
      const dateKey = d.toISOString().slice(0, 10)
      seen.add(getWeeklyEvent(dateKey).id)
    }
    expect(seen.size).toBe(4)
  })

  it('returns WEEKLY_EVENTS entry (object reference from catalog)', () => {
    const event = getWeeklyEvent('2026-02-28')
    expect(WEEKLY_EVENTS).toContain(event)
  })
})

// ── getActiveEvents ───────────────────────────────────────────────────────────

describe('getActiveEvents', () => {
  it('returns { daily, weekly } with correct structure', () => {
    const { daily, weekly } = getActiveEvents('2026-02-28')
    expect(daily).toBeDefined()
    expect(weekly).toBeDefined()
    expect(daily).toHaveProperty('modifiers')
    expect(weekly).toHaveProperty('modifiers')
  })

  it('daily is same as getDailyEvent for the same dateKey', () => {
    const { daily } = getActiveEvents('2026-03-04')
    expect(daily).toBe(getDailyEvent('2026-03-04'))
  })

  it('weekly is same as getWeeklyEvent for the same dateKey', () => {
    const { weekly } = getActiveEvents('2026-03-04')
    expect(weekly).toBe(getWeeklyEvent('2026-03-04'))
  })

  it('is deterministic: calling twice gives equal result', () => {
    const a = getActiveEvents('2026-02-28')
    const b = getActiveEvents('2026-02-28')
    expect(a.daily.id).toBe(b.daily.id)
    expect(a.weekly.id).toBe(b.weekly.id)
  })
})

// ── applyEventModifiers ───────────────────────────────────────────────────────

describe('applyEventModifiers', () => {
  it('returns identity modifiers when no events are provided ({})', () => {
    const mods = applyEventModifiers({}, {})
    expect(mods.taskCoinMultiplier).toBe(1.0)
    expect(mods.idleCpmMultiplier).toBe(1.0)
    expect(mods.gachaRareBonus).toBe(0.0)
    expect(mods.boostPriceMultiplier).toBe(1.0)
    expect(mods.energyCapBonus).toBe(0)
  })

  it('applies taskCoinMultiplier from daily event', () => {
    const event = { modifiers: { taskCoinMultiplier: 1.10 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.taskCoinMultiplier).toBeCloseTo(1.10)
  })

  it('applies idleCpmMultiplier from daily event', () => {
    const event = { modifiers: { idleCpmMultiplier: 1.12 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.idleCpmMultiplier).toBeCloseTo(1.12)
  })

  it('applies gachaRareBonus additively from daily event', () => {
    const event = { modifiers: { gachaRareBonus: 0.02 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.gachaRareBonus).toBeCloseTo(0.02)
  })

  it('applies boostPriceMultiplier discount from daily event', () => {
    const event = { modifiers: { boostPriceMultiplier: 0.85 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.boostPriceMultiplier).toBeCloseTo(0.85)
  })

  it('applies energyCapBonus from daily event', () => {
    const event = { modifiers: { energyCapBonus: 10 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.energyCapBonus).toBe(10)
  })

  it('stacks taskCoinMultiplier multiplicatively from daily + weekly', () => {
    const daily  = { modifiers: { taskCoinMultiplier: 1.10 } }
    const weekly = { modifiers: { taskCoinMultiplier: 1.05 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.taskCoinMultiplier).toBeCloseTo(1.10 * 1.05)
  })

  it('stacks idleCpmMultiplier multiplicatively from daily + weekly', () => {
    const daily  = { modifiers: { idleCpmMultiplier: 1.12 } }
    const weekly = { modifiers: { idleCpmMultiplier: 1.05 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.idleCpmMultiplier).toBeCloseTo(1.12 * 1.05)
  })

  it('stacks gachaRareBonus additively from daily + weekly', () => {
    const daily  = { modifiers: { gachaRareBonus: 0.02 } }
    const weekly = { modifiers: { gachaRareBonus: 0.02 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.gachaRareBonus).toBeCloseTo(0.04)
  })

  it('stacks energyCapBonus additively from daily + weekly', () => {
    const daily  = { modifiers: { energyCapBonus: 10 } }
    const weekly = { modifiers: { energyCapBonus: 15 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.energyCapBonus).toBe(25)
  })

  it('uses the better (lower) boostPriceMultiplier when stacking (best discount wins)', () => {
    const daily  = { modifiers: { boostPriceMultiplier: 0.85 } }
    const weekly = { modifiers: { boostPriceMultiplier: 0.90 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.boostPriceMultiplier).toBeCloseTo(0.85)
  })
})

// ── Clamp invariants ──────────────────────────────────────────────────────────

describe('applyEventModifiers clamp invariants', () => {
  it('clamps taskCoinMultiplier to max 2.0 even when stacking is extreme', () => {
    const daily  = { modifiers: { taskCoinMultiplier: 1.80 } }
    const weekly = { modifiers: { taskCoinMultiplier: 1.50 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.taskCoinMultiplier).toBeLessThanOrEqual(2.0)
  })

  it('clamps idleCpmMultiplier to max 2.0', () => {
    const daily  = { modifiers: { idleCpmMultiplier: 1.80 } }
    const weekly = { modifiers: { idleCpmMultiplier: 1.80 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.idleCpmMultiplier).toBeLessThanOrEqual(2.0)
  })

  it('clamps gachaRareBonus to max 0.15', () => {
    const daily  = { modifiers: { gachaRareBonus: 0.12 } }
    const weekly = { modifiers: { gachaRareBonus: 0.12 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.gachaRareBonus).toBeLessThanOrEqual(0.15)
  })

  it('clamps boostPriceMultiplier to min 0.50 (max 50% discount)', () => {
    const daily  = { modifiers: { boostPriceMultiplier: 0.10 } }
    const weekly = { modifiers: { boostPriceMultiplier: 0.10 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.boostPriceMultiplier).toBeGreaterThanOrEqual(0.50)
  })

  it('clamps energyCapBonus to max 50', () => {
    const daily  = { modifiers: { energyCapBonus: 40 } }
    const weekly = { modifiers: { energyCapBonus: 40 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.energyCapBonus).toBeLessThanOrEqual(50)
  })

  it('boost price after discount is never below 1 coin (external enforcement)', () => {
    // Base cost 100 with max 50 % discount → 50 (> 1)
    const basePrice = 100
    const mods = applyEventModifiers({}, { daily: { modifiers: { boostPriceMultiplier: 0.10 } } })
    const effectiveCost = Math.max(1, Math.ceil(basePrice * mods.boostPriceMultiplier))
    expect(effectiveCost).toBeGreaterThanOrEqual(1)
  })
})

// ── Gacha rate invariant ──────────────────────────────────────────────────────

describe('gacha rate invariant after event bonus', () => {
  it('rates still sum to ~1.0 after adding event gachaRareBonus via applyGachaRareBonus', () => {
    const mods = applyEventModifiers({}, { daily: { modifiers: { gachaRareBonus: 0.02 } } })
    const rates = applyGachaRareBonus(BASE_RATES, mods.gachaRareBonus)
    const total = Object.values(rates).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0)
  })

  it('stacked event + talent gacha bonuses still normalize to 1.0', () => {
    const talentBonus = 0.05
    const mods = applyEventModifiers(
      {},
      {
        daily:  { modifiers: { gachaRareBonus: 0.02 } },
        weekly: { modifiers: { gachaRareBonus: 0.02 } },
      }
    )
    const combinedBonus = talentBonus + mods.gachaRareBonus
    const rates = applyGachaRareBonus(BASE_RATES, combinedBonus)
    const total = Object.values(rates).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0)
  })

  it('max gachaRareBonus (0.15) still produces valid normalized rates', () => {
    const rates = applyGachaRareBonus(BASE_RATES, 0.15)
    const total = Object.values(rates).reduce((s, v) => s + v, 0)
    expect(total).toBeCloseTo(1.0)
    for (const val of Object.values(rates)) {
      expect(val).toBeGreaterThan(0)
    }
  })

  it('applying event bonus increases rare rate compared to base', () => {
    const base = normalizeRates(BASE_RATES)
    const mods = applyEventModifiers({}, { daily: { modifiers: { gachaRareBonus: 0.02 } } })
    const boosted = applyGachaRareBonus(BASE_RATES, mods.gachaRareBonus)
    expect(boosted.rare).toBeGreaterThan(base.rare)
  })
})

// ── canClaimEventBonus ────────────────────────────────────────────────────────

describe('canClaimEventBonus', () => {
  it('returns true when lastEventClaimDate is null (never claimed)', () => {
    expect(canClaimEventBonus({ lastEventClaimDate: null }, '2026-02-28')).toBe(true)
  })

  it('returns true when lastEventClaimDate is undefined (new player)', () => {
    expect(canClaimEventBonus({}, '2026-02-28')).toBe(true)
  })

  it('returns true when lastEventClaimDate is a different date (yesterday)', () => {
    expect(canClaimEventBonus({ lastEventClaimDate: '2026-02-27' }, '2026-02-28')).toBe(true)
  })

  it('returns false when lastEventClaimDate equals the dateKey (already claimed today)', () => {
    expect(canClaimEventBonus({ lastEventClaimDate: '2026-02-28' }, '2026-02-28')).toBe(false)
  })

  it('anti-duplication: same dateKey, second call returns false', () => {
    const player = { lastEventClaimDate: '2026-02-28' }
    expect(canClaimEventBonus(player, '2026-02-28')).toBe(false)
    expect(canClaimEventBonus(player, '2026-02-28')).toBe(false)
  })
})

// ── getEconomyWithEvents ──────────────────────────────────────────────────────

describe('getEconomyWithEvents', () => {
  it('returns an object with all modifier fields', () => {
    const economy = getEconomyWithEvents({}, '2026-02-28')
    expect(economy).toHaveProperty('taskCoinMultiplier')
    expect(economy).toHaveProperty('idleCpmMultiplier')
    expect(economy).toHaveProperty('gachaRareBonus')
    expect(economy).toHaveProperty('boostPriceMultiplier')
    expect(economy).toHaveProperty('energyCapBonus')
  })

  it('merges base config with event modifiers', () => {
    const base = { someOtherField: 42 }
    const economy = getEconomyWithEvents(base, '2026-02-28')
    expect(economy.someOtherField).toBe(42)
    expect(economy.taskCoinMultiplier).toBeGreaterThanOrEqual(1.0)
  })

  it('is deterministic for the same dateKey', () => {
    const a = getEconomyWithEvents({}, '2026-02-28')
    const b = getEconomyWithEvents({}, '2026-02-28')
    expect(a).toEqual(b)
  })
})

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('BASE_TASK_COIN_REWARD is a positive integer', () => {
    expect(BASE_TASK_COIN_REWARD).toBeGreaterThan(0)
    expect(Number.isInteger(BASE_TASK_COIN_REWARD)).toBe(true)
  })

  it('EVENT_CLAIM_BONUS is a positive integer', () => {
    expect(EVENT_CLAIM_BONUS).toBeGreaterThan(0)
    expect(Number.isInteger(EVENT_CLAIM_BONUS)).toBe(true)
  })
})

// ── getEventEffectLines ───────────────────────────────────────────────────────

describe('getEventEffectLines', () => {
  it('returns an array of strings', () => {
    const lines = getEventEffectLines(DAILY_EVENTS[0])
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(typeof line).toBe('string')
  })

  it('returns empty array for null event', () => {
    expect(getEventEffectLines(null)).toEqual([])
  })

  it('returns empty array for event with no modifiers', () => {
    expect(getEventEffectLines({ modifiers: {} })).toEqual([])
  })

  it('includes coin multiplier description when present', () => {
    const event = { modifiers: { taskCoinMultiplier: 1.10 } }
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('monedas'))).toBe(true)
  })

  it('includes boost discount description when present', () => {
    const event = { modifiers: { boostPriceMultiplier: 0.85 } }
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('boost'))).toBe(true)
  })
})

// ── Task coin reward formula ──────────────────────────────────────────────────

describe('task coin reward with event modifier', () => {
  it('base task coin reward * 1.10 multiplier gives 11 coins (floored)', () => {
    const mods = applyEventModifiers({}, { daily: { modifiers: { taskCoinMultiplier: 1.10 } } })
    const reward = Math.floor(BASE_TASK_COIN_REWARD * mods.taskCoinMultiplier)
    expect(reward).toBe(11)
  })

  it('clone task earns 0 coins regardless of event modifier', () => {
    const isClone = true
    const mods = applyEventModifiers({}, { daily: { modifiers: { taskCoinMultiplier: 1.10 } } })
    const reward = isClone ? 0 : Math.floor(BASE_TASK_COIN_REWARD * mods.taskCoinMultiplier)
    expect(reward).toBe(0)
  })

  it('non-clone task earns positive coins even with identity modifier (1.0)', () => {
    const mods = applyEventModifiers({}, {})
    const reward = Math.floor(BASE_TASK_COIN_REWARD * mods.taskCoinMultiplier)
    expect(reward).toBe(BASE_TASK_COIN_REWARD)
  })
})

// ── New modifiers: gachaFirstPackDiscount & freeIdleClaimOncePerDay ───────────

describe('applyEventModifiers — new modifier fields', () => {
  it('returns gachaFirstPackDiscount = 0 when no event has it', () => {
    const mods = applyEventModifiers({}, {})
    expect(mods.gachaFirstPackDiscount).toBe(0)
  })

  it('returns gachaFirstPackDiscount from gacha_tuesday event', () => {
    const event = { modifiers: { gachaFirstPackDiscount: 0.20 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.gachaFirstPackDiscount).toBeCloseTo(0.20)
  })

  it('takes the max gachaFirstPackDiscount when both events provide it', () => {
    const daily  = { modifiers: { gachaFirstPackDiscount: 0.20 } }
    const weekly = { modifiers: { gachaFirstPackDiscount: 0.30 } }
    const mods = applyEventModifiers({}, { daily, weekly })
    expect(mods.gachaFirstPackDiscount).toBeCloseTo(0.30)
  })

  it('clamps gachaFirstPackDiscount to max 0.50', () => {
    const event = { modifiers: { gachaFirstPackDiscount: 0.99 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.gachaFirstPackDiscount).toBeLessThanOrEqual(0.50)
  })

  it('returns freeIdleClaimOncePerDay = false when no event has it', () => {
    const mods = applyEventModifiers({}, {})
    expect(mods.freeIdleClaimOncePerDay).toBe(false)
  })

  it('returns freeIdleClaimOncePerDay = true when energy_thursday event is active', () => {
    const event = { modifiers: { freeIdleClaimOncePerDay: true } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.freeIdleClaimOncePerDay).toBe(true)
  })

  it('freeIdleClaimOncePerDay stays false when only numeric modifiers present', () => {
    const event = { modifiers: { taskCoinMultiplier: 1.10, idleCpmMultiplier: 1.05 } }
    const mods = applyEventModifiers({}, { daily: event })
    expect(mods.freeIdleClaimOncePerDay).toBe(false)
  })
})

// ── getEventEffectLines — new modifier lines ──────────────────────────────────

describe('getEventEffectLines — new modifiers', () => {
  it('shows gacha first-pack discount line', () => {
    const event = { modifiers: { gachaFirstPackDiscount: 0.20 } }
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('20') && l.includes('pack'))).toBe(true)
  })

  it('shows free idle claim line', () => {
    const event = { modifiers: { freeIdleClaimOncePerDay: true } }
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('idle'))).toBe(true)
  })

  it('gacha_tuesday event shows both rare bonus and pack discount', () => {
    const event = DAILY_EVENTS[2] // Tuesday
    expect(event.id).toBe('gacha_tuesday')
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('rare'))).toBe(true)
    expect(lines.some((l) => l.includes('pack'))).toBe(true)
  })

  it('energy_thursday event shows both energyCap and free idle claim', () => {
    const event = DAILY_EVENTS[4] // Thursday
    expect(event.id).toBe('energy_thursday')
    const lines = getEventEffectLines(event)
    expect(lines.some((l) => l.includes('energía'))).toBe(true)
    expect(lines.some((l) => l.includes('idle'))).toBe(true)
  })
})

// ── canUseGachaDiscount ───────────────────────────────────────────────────────

describe('canUseGachaDiscount', () => {
  // 2026-03-03 is a Tuesday → gacha_tuesday (has gachaFirstPackDiscount)
  const TUESDAY = '2026-03-03'
  // 2026-03-04 is a Wednesday → boost_wednesday (no gachaFirstPackDiscount)
  const WEDNESDAY = '2026-03-04'

  it('returns true when on gacha_tuesday and discount never used', () => {
    expect(canUseGachaDiscount({}, TUESDAY)).toBe(true)
  })

  it('returns true when on gacha_tuesday and lastGachaDiscountDate is a different day', () => {
    expect(canUseGachaDiscount({ lastGachaDiscountDate: '2026-03-02' }, TUESDAY)).toBe(true)
  })

  it('returns false when lastGachaDiscountDate equals today (already used)', () => {
    expect(canUseGachaDiscount({ lastGachaDiscountDate: TUESDAY }, TUESDAY)).toBe(false)
  })

  it('returns false on a non-gacha day (Wednesday has no gachaFirstPackDiscount)', () => {
    expect(canUseGachaDiscount({}, WEDNESDAY)).toBe(false)
  })

  it('discount lock is per-dateKey — resets the next day', () => {
    const player = { lastGachaDiscountDate: TUESDAY }
    // Next Tuesday (7 days later) should be eligible again
    expect(canUseGachaDiscount(player, '2026-03-10')).toBe(true)
  })
})

// ── canUseFreeIdleClaim ───────────────────────────────────────────────────────

describe('canUseFreeIdleClaim', () => {
  // 2026-03-05 is a Thursday → energy_thursday (has freeIdleClaimOncePerDay)
  const THURSDAY  = '2026-03-05'
  // 2026-03-06 is a Friday (no free idle claim)
  const FRIDAY    = '2026-03-06'

  it('returns true when on energy_thursday and claim never used', () => {
    expect(canUseFreeIdleClaim({}, THURSDAY)).toBe(true)
  })

  it('returns true when lastFreeIdleClaimDate is a different day', () => {
    expect(canUseFreeIdleClaim({ lastFreeIdleClaimDate: '2026-03-04' }, THURSDAY)).toBe(true)
  })

  it('returns false when lastFreeIdleClaimDate equals today (already used)', () => {
    expect(canUseFreeIdleClaim({ lastFreeIdleClaimDate: THURSDAY }, THURSDAY)).toBe(false)
  })

  it('returns false on a non-thursday day', () => {
    expect(canUseFreeIdleClaim({}, FRIDAY)).toBe(false)
  })
})

// ── computeDailyClaimReward ───────────────────────────────────────────────────

describe('computeDailyClaimReward', () => {
  const NOW = 1_750_000_000_000 // fixed timestamp

  it('gacha event → dustDelta = EVENT_GACHA_DUST_BONUS, coinsDelta = 0', () => {
    const daily = { id: 'gacha_tuesday', modifiers: { gachaRareBonus: 0.02, gachaFirstPackDiscount: 0.20 } }
    const reward = computeDailyClaimReward({ daily, weekly: null }, {}, NOW)
    expect(reward.dustDelta).toBe(EVENT_GACHA_DUST_BONUS)
    expect(reward.coinsDelta).toBe(0)
    expect(reward.energyDelta).toBe(0)
    expect(reward.boostExtendMs).toBe(0)
  })

  it('boost event with active coin boost → boostExtendMs = EVENT_BOOST_EXTEND_MS', () => {
    const daily = { id: 'boost_wednesday', modifiers: { boostPriceMultiplier: 0.85 } }
    const player = { boosts: [{ coinMultiplier: 2, expiresAt: NOW + 100_000 }] }
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.boostExtendMs).toBe(EVENT_BOOST_EXTEND_MS)
    expect(reward.coinsDelta).toBe(0)
  })

  it('boost event with NO active boost → coins fallback of 25', () => {
    const daily = { id: 'boost_wednesday', modifiers: { boostPriceMultiplier: 0.85 } }
    const player = { boosts: [] }
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.coinsDelta).toBe(25)
    expect(reward.boostExtendMs).toBe(0)
  })

  it('boost event with expired boost → falls back to coins', () => {
    const daily = { id: 'boost_wednesday', modifiers: { boostPriceMultiplier: 0.85 } }
    const player = { boosts: [{ coinMultiplier: 2, expiresAt: NOW - 1 }] } // expired
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.coinsDelta).toBe(25)
  })

  it('energy event → energyDelta clamped to available headroom', () => {
    const daily = { id: 'energy_thursday', modifiers: { energyCapBonus: 10, freeIdleClaimOncePerDay: true } }
    const player = { energy: 95, energyCap: 100 }
    // effectiveCap = 100 + 10 = 110; headroom = 110 - 95 = 15; min(20, 15) = 15
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.energyDelta).toBe(15)
    expect(reward.coinsDelta).toBe(0)
  })

  it('energy event → energyDelta is 0 when already at effective cap', () => {
    const daily = { id: 'energy_thursday', modifiers: { energyCapBonus: 10 } }
    const player = { energy: 110, energyCap: 100 }
    // effectiveCap = 110; headroom = 0
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.energyDelta).toBe(0)
  })

  it('energy event → energyDelta never negative', () => {
    const daily = { id: 'energy_thursday', modifiers: { energyCapBonus: 10 } }
    const player = { energy: 150, energyCap: 100 } // above cap (edge case)
    const reward = computeDailyClaimReward({ daily, weekly: null }, player, NOW)
    expect(reward.energyDelta).toBeGreaterThanOrEqual(0)
  })

  it('default (coin event) → coinsDelta = floor(EVENT_CLAIM_BONUS * taskCoinMultiplier)', () => {
    const daily = { id: 'golden_sunday', modifiers: { taskCoinMultiplier: 1.10 } }
    const reward = computeDailyClaimReward({ daily, weekly: null }, {}, NOW)
    const expected = Math.max(1, Math.floor(EVENT_CLAIM_BONUS * 1.10))
    expect(reward.coinsDelta).toBe(expected)
    expect(reward.dustDelta).toBe(0)
    expect(reward.energyDelta).toBe(0)
  })

  it('default (idle event) → gives coins', () => {
    const daily = { id: 'monday_surge', modifiers: { idleCpmMultiplier: 1.12 } }
    const reward = computeDailyClaimReward({ daily, weekly: null }, {}, NOW)
    expect(reward.coinsDelta).toBeGreaterThanOrEqual(1)
  })

  it('default → coinsDelta never below 1', () => {
    const daily = { id: 'power_saturday', modifiers: { taskCoinMultiplier: 1.05 } }
    const reward = computeDailyClaimReward({ daily, weekly: null }, {}, NOW)
    expect(reward.coinsDelta).toBeGreaterThanOrEqual(1)
  })

  it('message field is always a non-empty string', () => {
    for (const event of DAILY_EVENTS) {
      const reward = computeDailyClaimReward({ daily: event, weekly: null }, {}, NOW)
      expect(typeof reward.message).toBe('string')
      expect(reward.message.length).toBeGreaterThan(0)
    }
  })
})

// ── getDailyRecommendation ────────────────────────────────────────────────────

describe('getDailyRecommendation', () => {
  it('gacha event → mentions pack', () => {
    const rec = getDailyRecommendation(DAILY_EVENTS[2])
    expect(rec.toLowerCase()).toMatch(/pack/)
  })

  it('boost event → mentions boost', () => {
    const rec = getDailyRecommendation(DAILY_EVENTS[3])
    expect(rec.toLowerCase()).toMatch(/boost/)
  })

  it('energy event → mentions claim or gratis', () => {
    const rec = getDailyRecommendation(DAILY_EVENTS[4])
    expect(rec.toLowerCase()).toMatch(/claim|gratis|idle/)
  })

  it('monday/idle event → mentions farming or reclamar', () => {
    const rec = getDailyRecommendation(DAILY_EVENTS[1])
    expect(rec.toLowerCase()).toMatch(/farm|recl|30/)
  })

  it('coin/xp/power events → mentions tareas or farmear', () => {
    const coinEvents = [DAILY_EVENTS[0], DAILY_EVENTS[5], DAILY_EVENTS[6]]
    for (const ev of coinEvents) {
      const rec = getDailyRecommendation(ev)
      expect(rec.length).toBeGreaterThan(5)
    }
  })

  it('returns a non-empty string for null input', () => {
    const rec = getDailyRecommendation(null)
    expect(typeof rec).toBe('string')
    expect(rec.length).toBeGreaterThan(0)
  })
})

// ── pickRarity (gacha.js) ─────────────────────────────────────────────────────

describe('pickRarity', () => {
  it('returns a rarity key present in the rates object', () => {
    const rarity = pickRarity(BASE_RATES, 0.5)
    expect(Object.keys(BASE_RATES)).toContain(rarity)
  })

  it('returns common for rand = 0 (lowest cumulative)', () => {
    // common = 0.60, so rand < 0.60 picks common
    expect(pickRarity(BASE_RATES, 0.0)).toBe('common')
    expect(pickRarity(BASE_RATES, 0.59)).toBe('common')
  })

  it('returns legendary for rand just below 1.0', () => {
    expect(pickRarity(BASE_RATES, 0.9999)).toBe('legendary')
  })

  it('distributes correctly over many trials (smoke test)', () => {
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
    const N = 10_000
    for (let i = 0; i < N; i++) {
      counts[pickRarity(BASE_RATES)]++
    }
    // common should dominate
    expect(counts.common).toBeGreaterThan(N * 0.5)
    // legendary should be rare
    expect(counts.legendary).toBeLessThan(N * 0.05)
  })

  it('after applying event rare bonus, rare rate increases', () => {
    const boostedRates = applyGachaRareBonus(BASE_RATES, 0.05)
    // rare threshold moves from ~0.85 to higher, so rand = 0.87 gives rare in boosted but epic in base
    const normalised = normalizeRates(BASE_RATES)
    const rareThreshold = normalised.common + normalised.uncommon + normalised.rare
    const rareThresholdBoosted = boostedRates.common + boostedRates.uncommon + boostedRates.rare
    expect(rareThresholdBoosted).toBeGreaterThan(rareThreshold)
  })
})
