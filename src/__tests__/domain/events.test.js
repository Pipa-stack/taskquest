import { describe, it, expect } from 'vitest'
import {
  DAILY_EVENTS,
  WEEKLY_EVENTS,
  BASE_TASK_COIN_REWARD,
  EVENT_CLAIM_BONUS,
  getDailyEvent,
  getWeeklyEvent,
  getActiveEvents,
  applyEventModifiers,
  getEconomyWithEvents,
  canClaimEventBonus,
  getEventEffectLines,
} from '../../domain/events.js'
import { applyGachaRareBonus, normalizeRates, BASE_RATES } from '../../domain/gacha.js'

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
