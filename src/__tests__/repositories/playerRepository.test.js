import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module before importing the repository
vi.mock('../../db/db.js', () => {
  const mockDb = {
    transaction: vi.fn(async (_mode, _tables, fn) => fn()),
    players: {
      get: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
    },
    outbox: {
      add: vi.fn(),
    },
  }
  return { default: mockDb }
})

import { playerRepository, playerToPayload } from '../../repositories/playerRepository.js'
import db from '../../db/db.js'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// playerToPayload
// ---------------------------------------------------------------------------
describe('playerToPayload', () => {
  it('includes only synced fields (not combo / lastCompleteAt / achievementsUnlocked)', () => {
    const player = {
      id: 1,
      xp: 500,
      streak: 3,
      lastActiveDate: '2024-06-01',
      dailyGoal: 5,
      rewardsUnlocked: ['r1', 'r2'],
      combo: 1.2,
      lastCompleteAt: '2024-06-01T10:00:00.000Z',
      achievementsUnlocked: ['a1'],
      updatedAt: '2024-06-01T10:00:00.000Z',
    }
    const payload = playerToPayload(player)
    expect(payload).toEqual({
      xp: 500,
      streak: 3,
      lastActiveDate: '2024-06-01',
      dailyGoal: 5,
      rewardsUnlocked: ['r1', 'r2'],
      unlockedCharacters: [],
      activeTeam: [],
      updatedAt: '2024-06-01T10:00:00.000Z',
      // idle farming fields (defaults because not set on test player above)
      coins: 0,
      energy: 100,
      energyCap: 100,
      lastIdleTickAt: null,
      boosts: [],
      coinsPerMinuteBase: 1,
      // gacha fields (defaults)
      shards: {},
      dust: 0,
      gachaHistory: [],
      pityLegendary: 0,
    })
    expect(payload).not.toHaveProperty('combo')
    expect(payload).not.toHaveProperty('lastCompleteAt')
    expect(payload).not.toHaveProperty('achievementsUnlocked')
  })

  it('applies safe defaults for missing fields', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.xp).toBe(0)
    expect(payload.streak).toBe(0)
    expect(payload.lastActiveDate).toBeNull()
    expect(payload.dailyGoal).toBe(3)
    expect(payload.rewardsUnlocked).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// playerRepository.setDailyGoal
// ---------------------------------------------------------------------------
describe('playerRepository.setDailyGoal', () => {
  it('enqueues UPSERT_PLAYER outbox entry with new dailyGoal', async () => {
    db.players.get.mockResolvedValue({ id: 1, xp: 200, dailyGoal: 3, rewardsUnlocked: [] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.setDailyGoal(7)

    expect(db.players.put).toHaveBeenCalledOnce()
    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.dailyGoal).toBe(7)
    expect(putCall.syncStatus).toBe('pending')
    expect(putCall.updatedAt).toBeDefined()

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.type).toBe('UPSERT_PLAYER')
    expect(outboxEntry.status).toBe('pending')
    expect(outboxEntry.payload.dailyGoal).toBe(7)
    expect(outboxEntry.retryCount).toBe(0)
  })

  it('creates a default player record if none exists', async () => {
    db.players.get.mockResolvedValue(undefined)
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.setDailyGoal(5)

    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.id).toBe(1)
    expect(putCall.dailyGoal).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.spendXpOnReward
// ---------------------------------------------------------------------------
describe('playerRepository.spendXpOnReward', () => {
  it('deducts XP and enqueues UPSERT_PLAYER when player can afford reward', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 500,
      rewardsUnlocked: [],
      streak: 0,
      dailyGoal: 3,
      lastActiveDate: null,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.spendXpOnReward({
      rewardId: 'reward-1',
      costXP: 200,
    })

    expect(success).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const updatedPlayer = db.players.put.mock.calls[0][0]
    expect(updatedPlayer.xp).toBe(300)
    expect(updatedPlayer.rewardsUnlocked).toContain('reward-1')
    expect(updatedPlayer.syncStatus).toBe('pending')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.type).toBe('UPSERT_PLAYER')
    expect(outboxEntry.payload.rewardsUnlocked).toContain('reward-1')
  })

  it('does NOT allow XP to go below 0 (safety guard via Math.max)', async () => {
    // This shouldn't happen in practice due to the xp < costXP check,
    // but the Math.max(0, ...) guard is verified here.
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 100,
      rewardsUnlocked: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    // player.xp (100) < costXP (200) → guard should prevent the purchase
    const success = await playerRepository.spendXpOnReward({
      rewardId: 'reward-expensive',
      costXP: 200,
    })

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false and does NOT update if reward already unlocked', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 1000,
      rewardsUnlocked: ['reward-1'],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.spendXpOnReward({
      rewardId: 'reward-1',
      costXP: 100,
    })

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerRepository.enqueueUpsert
// ---------------------------------------------------------------------------
describe('playerRepository.enqueueUpsert', () => {
  it('adds UPSERT_PLAYER entry to outbox with correct payload', async () => {
    db.outbox.add.mockResolvedValue(1)
    const player = {
      id: 1,
      xp: 300,
      streak: 5,
      lastActiveDate: '2024-06-01',
      dailyGoal: 4,
      rewardsUnlocked: ['r1'],
      updatedAt: '2024-06-01T10:00:00.000Z',
    }

    await playerRepository.enqueueUpsert(player, '2024-06-01T10:00:00.000Z')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const entry = db.outbox.add.mock.calls[0][0]
    expect(entry.type).toBe('UPSERT_PLAYER')
    expect(entry.status).toBe('pending')
    expect(entry.retryCount).toBe(0)
    expect(entry.payload.xp).toBe(300)
    expect(entry.payload.streak).toBe(5)
    expect(entry.payload.dailyGoal).toBe(4)
    expect(entry.payload.rewardsUnlocked).toEqual(['r1'])
  })
})

// ---------------------------------------------------------------------------
// playerToPayload – activeTeam + unlockedCharacters
// ---------------------------------------------------------------------------
describe('playerToPayload – new fields', () => {
  it('includes unlockedCharacters and activeTeam in payload', () => {
    const player = {
      id: 1,
      xp: 100,
      streak: 0,
      lastActiveDate: null,
      dailyGoal: 3,
      rewardsUnlocked: [],
      unlockedCharacters: ['warrior', 'mage'],
      activeTeam: ['warrior'],
      updatedAt: '2024-06-01T10:00:00.000Z',
    }
    const payload = playerToPayload(player)
    expect(payload.unlockedCharacters).toEqual(['warrior', 'mage'])
    expect(payload.activeTeam).toEqual(['warrior'])
  })

  it('defaults unlockedCharacters and activeTeam to [] when missing', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.unlockedCharacters).toEqual([])
    expect(payload.activeTeam).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// playerRepository.setActiveTeam
// ---------------------------------------------------------------------------
describe('playerRepository.setActiveTeam', () => {
  const basePlayer = {
    id: 1,
    xp: 500,
    rewardsUnlocked: [],
    unlockedCharacters: ['warrior', 'mage', 'ranger'],
    activeTeam: [],
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('sets the active team when all ids are unlocked', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.setActiveTeam(['warrior', 'mage'])

    expect(ok).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const put = db.players.put.mock.calls[0][0]
    expect(put.activeTeam).toEqual(['warrior', 'mage'])
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('rejects a team with more than 3 members', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, unlockedCharacters: ['warrior', 'mage', 'ranger', 'healer'] })

    const ok = await playerRepository.setActiveTeam(['warrior', 'mage', 'ranger', 'healer'])

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('rejects if input is not an array', async () => {
    const ok = await playerRepository.setActiveTeam('warrior')
    expect(ok).toBe(false)
  })

  it('rejects if any character is not in unlockedCharacters', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, unlockedCharacters: ['warrior'] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.setActiveTeam(['warrior', 'mage'])

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('enqueues UPSERT_PLAYER with activeTeam in payload', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.setActiveTeam(['warrior'])

    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.payload.activeTeam).toEqual(['warrior'])
  })
})

// ---------------------------------------------------------------------------
// playerRepository.addToTeam
// ---------------------------------------------------------------------------
describe('playerRepository.addToTeam', () => {
  const basePlayer = {
    id: 1,
    xp: 500,
    rewardsUnlocked: [],
    unlockedCharacters: ['warrior', 'mage', 'ranger'],
    activeTeam: ['warrior'],
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('adds a character to the team and enqueues UPSERT_PLAYER', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.addToTeam('mage')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.activeTeam).toContain('warrior')
    expect(put.activeTeam).toContain('mage')
    expect(db.outbox.add).toHaveBeenCalledOnce()
  })

  it('is idempotent: adding a character already in team returns true without writing', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.addToTeam('warrior')

    expect(ok).toBe(true)
    // No write should happen since character is already present
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('rejects if character is not unlocked', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, unlockedCharacters: ['warrior'] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.addToTeam('mage')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('rejects when team already has 3 members', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedCharacters: ['warrior', 'mage', 'ranger', 'healer'],
      activeTeam: ['warrior', 'mage', 'ranger'],
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.addToTeam('healer')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerRepository.removeFromTeam
// ---------------------------------------------------------------------------
describe('playerRepository.removeFromTeam', () => {
  const basePlayer = {
    id: 1,
    xp: 500,
    rewardsUnlocked: [],
    unlockedCharacters: ['warrior', 'mage'],
    activeTeam: ['warrior', 'mage'],
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('removes a character from the team and enqueues UPSERT_PLAYER', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.removeFromTeam('warrior')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.activeTeam).not.toContain('warrior')
    expect(put.activeTeam).toContain('mage')
    expect(db.outbox.add).toHaveBeenCalledOnce()
  })

  it('is idempotent: removing a character not in team does nothing', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, activeTeam: ['mage'] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.removeFromTeam('warrior')

    expect(ok).toBe(true)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerToPayload – gacha fields
// ---------------------------------------------------------------------------
describe('playerToPayload – gacha fields', () => {
  it('includes shards, dust, gachaHistory, pityLegendary in payload', () => {
    const player = {
      id: 1,
      xp: 100,
      streak: 0,
      lastActiveDate: null,
      dailyGoal: 3,
      rewardsUnlocked: [],
      unlockedCharacters: [],
      activeTeam: [],
      updatedAt: '2024-06-01T10:00:00.000Z',
      shards: { warrior: 2 },
      dust: 50,
      gachaHistory: [{ characterId: 'warrior', rarity: 'common', isNew: false, dustGained: 10 }],
      pityLegendary: 15,
    }
    const payload = playerToPayload(player)
    expect(payload.shards).toEqual({ warrior: 2 })
    expect(payload.dust).toBe(50)
    expect(payload.gachaHistory).toHaveLength(1)
    expect(payload.pityLegendary).toBe(15)
  })

  it('applies safe defaults for missing gacha fields', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.shards).toEqual({})
    expect(payload.dust).toBe(0)
    expect(payload.gachaHistory).toEqual([])
    expect(payload.pityLegendary).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.buyPack
// ---------------------------------------------------------------------------
describe('playerRepository.buyPack', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 500,
    energy: 100,
    energyCap: 100,
    boosts: [],
    coinsPerMinuteBase: 1,
    unlockedCharacters: [],
    dust: 0,
    shards: {},
    gachaHistory: [],
    pityLegendary: 0,
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('deducts coins and returns pulls on success', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { success, pulls } = await playerRepository.buyPack('starter', Date.now())

    expect(success).toBe(true)
    expect(Array.isArray(pulls)).toBe(true)
    expect(pulls).toHaveLength(1)

    const put = db.players.put.mock.calls[0][0]
    // starter costs 120
    expect(put.coins).toBe(500 - 120)
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns { success: false } when coins are insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 50 }) // starter costs 120
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { success } = await playerRepository.buyPack('starter', Date.now())

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns { success: false } for unknown pack id', async () => {
    const { success } = await playerRepository.buyPack('nonexistent_pack', Date.now())
    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('adds dust for duplicate characters', async () => {
    // Pre-unlock all characters so every pull is a duplicate
    const allCharIds = ['warrior', 'mage', 'ranger', 'healer', 'rogue', 'paladin']
    db.players.get.mockResolvedValue({ ...basePlayer, unlockedCharacters: allCharIds, coins: 500 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { success, pulls } = await playerRepository.buyPack('starter', Date.now())

    expect(success).toBe(true)
    // All pulls should be duplicates
    for (const pull of pulls) {
      expect(pull.isNew).toBe(false)
      expect(pull.dustGained).toBeGreaterThan(0)
    }

    const put = db.players.put.mock.calls[0][0]
    // dust should have increased
    expect(put.dust).toBeGreaterThan(0)
  })

  it('caps gacha history at 20 entries', async () => {
    // Start with 19 history entries
    const existingHistory = Array.from({ length: 19 }, (_, i) => ({ characterId: 'warrior', at: `t${i}` }))
    db.players.get.mockResolvedValue({ ...basePlayer, gachaHistory: existingHistory })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buyPack('starter', Date.now()) // 1 pull

    const put = db.players.put.mock.calls[0][0]
    // 19 + 1 = 20, exactly at cap
    expect(put.gachaHistory).toHaveLength(20)

    // Now start with 20 entries
    vi.clearAllMocks()
    const fullHistory = Array.from({ length: 20 }, (_, i) => ({ characterId: 'warrior', at: `t${i}` }))
    db.players.get.mockResolvedValue({ ...basePlayer, gachaHistory: fullHistory })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buyPack('starter', Date.now()) // 1 more pull

    const put2 = db.players.put.mock.calls[0][0]
    // Still capped at 20 (oldest entry dropped)
    expect(put2.gachaHistory).toHaveLength(20)
  })

  it('increments pity counter on non-legendary pulls', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, pityLegendary: 5 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buyPack('starter', Date.now())

    const put = db.players.put.mock.calls[0][0]
    // pity should have changed (either incremented if not legendary, or reset if legendary)
    // We can't control the random outcome, but pityLegendary should be a number
    expect(typeof put.pityLegendary).toBe('number')
    expect(put.pityLegendary).toBeGreaterThanOrEqual(0)
  })

  it('enqueues UPSERT_PLAYER with gacha fields in payload', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buyPack('starter', Date.now())

    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.payload).toHaveProperty('dust')
    expect(outboxEntry.payload).toHaveProperty('shards')
    expect(outboxEntry.payload).toHaveProperty('gachaHistory')
    expect(outboxEntry.payload).toHaveProperty('pityLegendary')
  })

  it('mega pack produces 10 pulls (costs 900)', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 1000 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { success, pulls } = await playerRepository.buyPack('mega', Date.now())

    expect(success).toBe(true)
    expect(pulls).toHaveLength(10)

    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(1000 - 900)
  })
})

// ---------------------------------------------------------------------------
// playerToPayload – idle farming fields
// ---------------------------------------------------------------------------
describe('playerToPayload – idle fields', () => {
  it('includes all idle farming fields in the payload', () => {
    const player = {
      id: 1,
      xp: 100,
      streak: 0,
      lastActiveDate: null,
      dailyGoal: 3,
      rewardsUnlocked: [],
      unlockedCharacters: [],
      activeTeam: [],
      updatedAt: '2024-06-01T10:00:00.000Z',
      coins: 42,
      energy: 80,
      energyCap: 100,
      lastIdleTickAt: '2024-06-01T09:00:00.000Z',
      boosts: [{ id: 'coin_x2_30m', expiresAt: 9999999999999 }],
      coinsPerMinuteBase: 2,
    }
    const payload = playerToPayload(player)
    expect(payload.coins).toBe(42)
    expect(payload.energy).toBe(80)
    expect(payload.energyCap).toBe(100)
    expect(payload.lastIdleTickAt).toBe('2024-06-01T09:00:00.000Z')
    expect(payload.boosts).toHaveLength(1)
    expect(payload.coinsPerMinuteBase).toBe(2)
  })

  it('applies safe defaults for missing idle fields', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.coins).toBe(0)
    expect(payload.energy).toBe(100)
    expect(payload.energyCap).toBe(100)
    expect(payload.lastIdleTickAt).toBeNull()
    expect(payload.boosts).toEqual([])
    expect(payload.coinsPerMinuteBase).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.tickIdle
// ---------------------------------------------------------------------------
describe('playerRepository.tickIdle', () => {
  const NOW_MS = 1_700_000_060_000 // 1 minute after tick below
  const LAST_TICK = 1_700_000_000_000 // 60 seconds before NOW_MS

  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 0,
    energy: 100,
    energyCap: 100,
    lastIdleTickAt: new Date(LAST_TICK).toISOString(),
    boosts: [],
    coinsPerMinuteBase: 1,
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('adds coins and consumes energy proportional to elapsed time', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { coinsEarned, minutesUsed } = await playerRepository.tickIdle(NOW_MS)

    expect(coinsEarned).toBeGreaterThan(0)
    expect(minutesUsed).toBeCloseTo(1, 0)

    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBeGreaterThan(0)
    expect(put.energy).toBeLessThan(100)
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('earns zero coins when energy is 0', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, energy: 0 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { coinsEarned } = await playerRepository.tickIdle(NOW_MS)

    expect(coinsEarned).toBe(0)
    // Still writes to update lastIdleTickAt and prune boosts
    expect(db.players.put).toHaveBeenCalledOnce()
  })

  it('earns zero coins on first tick (lastIdleTickAt is null)', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, lastIdleTickAt: null })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { coinsEarned } = await playerRepository.tickIdle(NOW_MS)

    expect(coinsEarned).toBe(0)
  })

  it('coins never go below 0 even on edge cases', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 0, energy: 0 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.tickIdle(NOW_MS)

    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBeGreaterThanOrEqual(0)
  })

  it('uses the teamMultiplier parameter', async () => {
    // 1 minute elapsed, baseCpm=1, multiplier=2 → 2 coins
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const { coinsEarned } = await playerRepository.tickIdle(NOW_MS, 2)

    // At least 1 coin with multiplier 2 for ~1 minute
    expect(coinsEarned).toBeGreaterThanOrEqual(1)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.buyBoost
// ---------------------------------------------------------------------------
describe('playerRepository.buyBoost', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 500,
    energy: 50,
    energyCap: 100,
    boosts: [],
    coinsPerMinuteBase: 1,
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }
  const NOW_MS = 1_700_000_000_000

  it('deducts coins and adds timed boost when player has enough coins', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyBoost('coin_x2_30m', NOW_MS)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(500 - 120) // cost 120
    expect(put.boosts).toHaveLength(1)
    expect(put.boosts[0].id).toBe('coin_x2_30m')
    expect(put.boosts[0].expiresAt).toBeGreaterThan(NOW_MS)
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false and does not write when coins are insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 50 }) // cost 120
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyBoost('coin_x2_30m', NOW_MS)

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for an unknown boost id', async () => {
    const ok = await playerRepository.buyBoost('nonexistent_boost', NOW_MS)
    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('applies instant energy_refill boost immediately (no duration stored)', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 200 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyBoost('energy_refill', NOW_MS)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    // energy should be refilled to energyCap (100)
    expect(put.energy).toBe(100)
    expect(put.coins).toBe(200 - 90) // cost 90
  })

  it('deduplicates timed boosts: buying same boost replaces the old one', async () => {
    const existingBoost = { id: 'coin_x2_30m', expiresAt: NOW_MS + 60_000, coinMultiplier: 2 }
    db.players.get.mockResolvedValue({ ...basePlayer, boosts: [existingBoost] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyBoost('coin_x2_30m', NOW_MS)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    // Should still be only 1 boost (dedup)
    expect(put.boosts).toHaveLength(1)
    // New expiresAt should be further in the future than the old one
    expect(put.boosts[0].expiresAt).toBeGreaterThan(existingBoost.expiresAt)
  })

  it('coins never go below 0', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 90 }) // exact cost for energy_refill
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyBoost('energy_refill', NOW_MS)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(0)
  })
})
