import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db before importing repairService
vi.mock('../../db/db.js', () => {
  let playerRecord = null
  let outboxRecords = []

  const mockDb = {
    _setPlayer: (p) => { playerRecord = p },
    _setOutbox: (items) => { outboxRecords = [...items] },
    _getPlayer: () => playerRecord,
    _getOutbox: () => outboxRecords,

    transaction: vi.fn(async (_mode, _tables, fn) => fn()),

    players: {
      get: vi.fn(async () => playerRecord),
      put: vi.fn(async (p) => { playerRecord = { ...p } }),
      update: vi.fn(async (_id, fields) => {
        if (playerRecord) Object.assign(playerRecord, fields)
      }),
    },

    outbox: {
      orderBy: vi.fn(),
      toArray: vi.fn(async () => outboxRecords),
      bulkDelete: vi.fn(async (ids) => {
        outboxRecords = outboxRecords.filter((item) => !ids.includes(item.id))
      }),
    },
  }
  return { default: mockDb }
})

import {
  repairLocalPlayer,
  hasSevereCorruption,
  previewRepairPlayer,
  repairDb,
  CAP_UNLOCKED_CHARACTERS,
  CAP_GACHA_HISTORY,
  CAP_OUTBOX,
} from '../../services/repairService.js'
import db from '../../db/db.js'

beforeEach(() => {
  vi.clearAllMocks()
  db._setPlayer(null)
  db._setOutbox([])

  // Re-wire transaction to actually call fn
  db.transaction.mockImplementation(async (_mode, _tables, fn) => fn())

  // Re-wire outbox.orderBy chain to return current outbox
  db.outbox.orderBy.mockReturnValue({
    toArray: vi.fn(async () => db._getOutbox()),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// repairLocalPlayer — numeric field clamping
// ─────────────────────────────────────────────────────────────────────────────
describe('repairLocalPlayer — numeric clamping', () => {
  it('clamps NaN coins to 0', () => {
    const { repaired, changes } = repairLocalPlayer({ id: 1, coins: NaN })
    expect(repaired.coins).toBe(0)
    expect(changes.some((c) => c.includes('coins'))).toBe(true)
  })

  it('clamps Infinity coins to 0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, coins: Infinity })
    expect(repaired.coins).toBe(0)
  })

  it('clamps negative xp to 0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, xp: -500 })
    expect(repaired.xp).toBe(0)
  })

  it('clamps NaN xp to 0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, xp: NaN })
    expect(repaired.xp).toBe(0)
  })

  it('clamps negative energy to 0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, energy: -10 })
    expect(repaired.energy).toBe(0)
  })

  it('clamps negative streak to 0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, streak: -5 })
    expect(repaired.streak).toBe(0)
  })

  it('clamps combo below 1.0 up to 1.0', () => {
    const { repaired } = repairLocalPlayer({ id: 1, combo: 0.5 })
    expect(repaired.combo).toBe(1.0)
  })

  it('clamps combo above 1.4 down to 1.4', () => {
    const { repaired } = repairLocalPlayer({ id: 1, combo: 9.9 })
    expect(repaired.combo).toBe(1.4)
  })

  it('does not modify valid numeric fields', () => {
    const { repaired, changes } = repairLocalPlayer({
      id: 1, coins: 100, xp: 500, streak: 3, combo: 1.2,
      achievementsUnlocked: [], rewardsUnlocked: [], boosts: [],
      activeTeam: [], unlockedCharacters: [],
      talents: { idle: 0, gacha: 0, power: 0 }, zoneProgress: {},
    })
    expect(repaired.coins).toBe(100)
    expect(repaired.xp).toBe(500)
    expect(changes.length).toBe(0)
  })

  it('clamps energy > energyCap down to energyCap', () => {
    const { repaired } = repairLocalPlayer({ id: 1, energy: 200, energyCap: 100 })
    expect(repaired.energy).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// repairLocalPlayer — array caps
// ─────────────────────────────────────────────────────────────────────────────
describe('repairLocalPlayer — array caps', () => {
  it('resets non-array achievementsUnlocked to []', () => {
    const { repaired } = repairLocalPlayer({ id: 1, achievementsUnlocked: 'invalid' })
    expect(repaired.achievementsUnlocked).toEqual([])
  })

  it('resets non-array rewardsUnlocked to []', () => {
    const { repaired } = repairLocalPlayer({ id: 1, rewardsUnlocked: null })
    expect(repaired.rewardsUnlocked).toEqual([])
  })

  it('truncates activeTeam to max 3', () => {
    const { repaired } = repairLocalPlayer({ id: 1, activeTeam: ['a', 'b', 'c', 'd', 'e'] })
    expect(repaired.activeTeam).toHaveLength(3)
  })

  it(`truncates unlockedCharacters to ${CAP_UNLOCKED_CHARACTERS}`, () => {
    const big = Array.from({ length: CAP_UNLOCKED_CHARACTERS + 10 }, (_, i) => `char_${i}`)
    const { repaired } = repairLocalPlayer({ id: 1, unlockedCharacters: big })
    expect(repaired.unlockedCharacters).toHaveLength(CAP_UNLOCKED_CHARACTERS)
  })

  it('does not truncate unlockedCharacters within cap', () => {
    const ok = Array.from({ length: 10 }, (_, i) => `char_${i}`)
    const { repaired } = repairLocalPlayer({ id: 1, unlockedCharacters: ok })
    expect(repaired.unlockedCharacters).toHaveLength(10)
  })

  it(`truncates gachaHistory to ${CAP_GACHA_HISTORY}, keeping most recent`, () => {
    const big = Array.from({ length: CAP_GACHA_HISTORY + 5 }, (_, i) => ({ roll: i }))
    const { repaired } = repairLocalPlayer({ id: 1, gachaHistory: big })
    expect(repaired.gachaHistory).toHaveLength(CAP_GACHA_HISTORY)
    // Most recent = last items in original array
    expect(repaired.gachaHistory[CAP_GACHA_HISTORY - 1]).toEqual({ roll: CAP_GACHA_HISTORY + 4 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// repairLocalPlayer — missing fields → defaults
// ─────────────────────────────────────────────────────────────────────────────
describe('repairLocalPlayer — missing fields get defaults', () => {
  it('returns defaults for null/undefined player', () => {
    const { repaired } = repairLocalPlayer(null)
    expect(repaired.id).toBe(1)
    expect(repaired.xp).toBe(0)
    expect(repaired.coins).toBe(0)
    expect(repaired.talents).toEqual({ idle: 0, gacha: 0, power: 0 })
  })

  it('resets talents to defaults if malformed', () => {
    const { repaired } = repairLocalPlayer({ id: 1, talents: 'bad' })
    expect(repaired.talents).toEqual({ idle: 0, gacha: 0, power: 0 })
  })

  it('resets zoneProgress to {} if not an object', () => {
    const { repaired } = repairLocalPlayer({ id: 1, zoneProgress: 'invalid' })
    expect(repaired.zoneProgress).toEqual({})
  })

  it('resets boosts to [] if not an array', () => {
    const { repaired } = repairLocalPlayer({ id: 1, boosts: 42 })
    expect(repaired.boosts).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// hasSevereCorruption
// ─────────────────────────────────────────────────────────────────────────────
describe('hasSevereCorruption', () => {
  it('returns false for null/undefined player', () => {
    expect(hasSevereCorruption(null)).toBe(false)
    expect(hasSevereCorruption(undefined)).toBe(false)
  })

  it('returns true when coins is NaN', () => {
    expect(hasSevereCorruption({ coins: NaN, xp: 0, energy: 100 })).toBe(true)
  })

  it('returns true when xp is Infinity', () => {
    expect(hasSevereCorruption({ coins: 0, xp: Infinity, energy: 100 })).toBe(true)
  })

  it('returns true when energy is negative', () => {
    expect(hasSevereCorruption({ coins: 0, xp: 0, energy: -1 })).toBe(true)
  })

  it('returns false for a healthy player', () => {
    expect(hasSevereCorruption({ coins: 100, xp: 500, energy: 80, achievementsUnlocked: [] })).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// repairDb — outbox truncation policy
// ─────────────────────────────────────────────────────────────────────────────
describe('repairDb — outbox truncation', () => {
  it('removes corrupt outbox entries (no type field)', async () => {
    db._setPlayer({ id: 1, coins: 0, xp: 0 })
    db._setOutbox([
      { id: 1, type: 'UPSERT_TASK', payload: { title: 'ok' }, status: 'pending' },
      { id: 2, payload: { title: 'bad' }, status: 'pending' }, // no type
    ])

    const { outboxRemoved } = await repairDb(db)
    expect(outboxRemoved).toBe(1)
  })

  it('removes outbox entries with missing payload', async () => {
    db._setPlayer({ id: 1, coins: 0, xp: 0 })
    db._setOutbox([
      { id: 1, type: 'UPSERT_TASK', payload: null, status: 'pending' },
    ])

    const { outboxRemoved } = await repairDb(db)
    expect(outboxRemoved).toBe(1)
  })

  it(`removes oldest entries when outbox exceeds ${CAP_OUTBOX}`, async () => {
    db._setPlayer({ id: 1, coins: 0, xp: 0 })
    const bigOutbox = Array.from({ length: CAP_OUTBOX + 5 }, (_, i) => ({
      id: i + 1,
      type: 'UPSERT_TASK',
      payload: { title: `task_${i}` },
      status: 'pending',
      createdAt: new Date(i * 1000).toISOString(),
    }))
    db._setOutbox(bigOutbox)

    const { outboxRemoved } = await repairDb(db)
    expect(outboxRemoved).toBe(5) // 5 excess entries removed
  })

  it('applies player repairs in same call', async () => {
    db._setPlayer({ id: 1, coins: NaN, xp: 100 })
    db._setOutbox([])

    const { playerChanges } = await repairDb(db)
    expect(playerChanges.some((c) => c.includes('coins'))).toBe(true)
    // Player should be updated
    expect(db.players.put).toHaveBeenCalled()
  })

  it('does not remove valid outbox entries', async () => {
    db._setPlayer({ id: 1, coins: 0, xp: 0 })
    db._setOutbox([
      { id: 1, type: 'UPSERT_TASK', payload: { title: 'valid' }, status: 'pending' },
    ])

    const { outboxRemoved } = await repairDb(db)
    expect(outboxRemoved).toBe(0)
  })

  it('returns zero playerChanges when player is healthy', async () => {
    db._setPlayer({
      id: 1, coins: 100, xp: 500, streak: 3, combo: 1.2,
      achievementsUnlocked: [], rewardsUnlocked: [], boosts: [],
      activeTeam: [], unlockedCharacters: [],
      talents: { idle: 0, gacha: 0, power: 0 }, zoneProgress: {},
    })
    db._setOutbox([])

    const { playerChanges } = await repairDb(db)
    expect(playerChanges).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// previewRepairPlayer
// ─────────────────────────────────────────────────────────────────────────────
describe('previewRepairPlayer', () => {
  it('returns empty changes for a healthy player', () => {
    const { changes, changeCount } = previewRepairPlayer({
      id: 1, coins: 100, xp: 500, streak: 3, combo: 1.2,
      achievementsUnlocked: [], rewardsUnlocked: [], boosts: [],
      activeTeam: [], unlockedCharacters: [],
      talents: { idle: 0, gacha: 0, power: 0 }, zoneProgress: {},
    })
    expect(changeCount).toBe(0)
    expect(changes).toHaveLength(0)
  })

  it('reports NaN fields in changes', () => {
    const { changes, changeCount } = previewRepairPlayer({ id: 1, coins: NaN })
    expect(changeCount).toBeGreaterThan(0)
    expect(changes.some((c) => c.includes('coins'))).toBe(true)
  })

  it('does NOT mutate the original player object', () => {
    const original = { id: 1, coins: NaN }
    previewRepairPlayer(original)
    expect(original.coins).toBeNaN() // unchanged
  })
})
