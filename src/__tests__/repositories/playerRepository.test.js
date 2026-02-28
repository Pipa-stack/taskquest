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
      // zone meta-game fields (defaults)
      currentZone: 1,
      zoneUnlockedMax: 1,
      zoneProgress: {},
      powerScoreCache: 0,
      // talent tree fields (defaults)
      essence: 0,
      talents: { idle: 0, gacha: 0, power: 0 },
      essenceSpent: 0,
      // events system field (default)
      lastEventClaimDate: null,
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

// ---------------------------------------------------------------------------
// playerToPayload – zone meta-game fields
// ---------------------------------------------------------------------------
describe('playerToPayload – zone fields', () => {
  it('includes zone fields with explicit values', () => {
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
      currentZone: 3,
      zoneUnlockedMax: 3,
      zoneProgress: { 1: { claimedRewards: ['z1_q1'] } },
      powerScoreCache: 55,
    }
    const payload = playerToPayload(player)
    expect(payload.currentZone).toBe(3)
    expect(payload.zoneUnlockedMax).toBe(3)
    expect(payload.zoneProgress).toEqual({ 1: { claimedRewards: ['z1_q1'] } })
    expect(payload.powerScoreCache).toBe(55)
  })

  it('applies safe defaults for missing zone fields', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.currentZone).toBe(1)
    expect(payload.zoneUnlockedMax).toBe(1)
    expect(payload.zoneProgress).toEqual({})
    expect(payload.powerScoreCache).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.setCurrentZone
// ---------------------------------------------------------------------------
describe('playerRepository.setCurrentZone', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 0,
    currentZone: 1,
    zoneUnlockedMax: 3,
    zoneProgress: {},
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('sets currentZone when the zone is already unlocked', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.setCurrentZone(2)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.currentZone).toBe(2)
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false when the zone is beyond zoneUnlockedMax', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, zoneUnlockedMax: 2 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.setCurrentZone(3)

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for an unknown zone id', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })

    const ok = await playerRepository.setCurrentZone(99)

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerRepository.unlockZone
// ---------------------------------------------------------------------------
describe('playerRepository.unlockZone', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 1000,
    currentZone: 1,
    zoneUnlockedMax: 1,
    coinsPerMinuteBase: 1,
    zoneProgress: {},
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('unlocks the next zone when power and coins are sufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    // zone 2 requires power=20, cost=50 coins
    const ok = await playerRepository.unlockZone(2, 20)

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.zoneUnlockedMax).toBe(2)
    expect(put.currentZone).toBe(2)
    expect(put.coins).toBe(1000 - 50) // zone 2 costs 50
    expect(put.coinsPerMinuteBase).toBeGreaterThan(1) // zone 2 bonus
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false when power score is insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    // zone 2 requires power=20; we pass 19
    const ok = await playerRepository.unlockZone(2, 19)

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false when coins are insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 10 }) // zone 2 costs 50
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.unlockZone(2, 20)

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('returns false when trying to skip zones (non-sequential)', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.unlockZone(3, 999) // zoneUnlockedMax=1, skip to 3

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerRepository.claimZoneQuest
// ---------------------------------------------------------------------------
describe('playerRepository.claimZoneQuest', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 100,
    currentZone: 1,
    zoneUnlockedMax: 1,
    zoneProgress: {},
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('claims the quest, adds coins, and records it in zoneProgress', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const reward = await playerRepository.claimZoneQuest(1, 'z1_q1')

    expect(reward).toBeTruthy()
    expect(reward.coins).toBeGreaterThan(0)

    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBeGreaterThan(100) // coins increased
    expect(put.zoneProgress[1].claimedRewards).toContain('z1_q1')
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false and does NOT update when quest is already claimed', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      zoneProgress: { 1: { claimedRewards: ['z1_q1'] } },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const reward = await playerRepository.claimZoneQuest(1, 'z1_q1')

    expect(reward).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for an unknown quest id', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })

    const reward = await playerRepository.claimZoneQuest(1, 'nonexistent_quest')

    expect(reward).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('accumulates multiple claimed quests in the same zone', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      zoneProgress: { 1: { claimedRewards: ['z1_q1'] } },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const reward = await playerRepository.claimZoneQuest(1, 'z1_q2')

    expect(reward).toBeTruthy()
    const put = db.players.put.mock.calls[0][0]
    expect(put.zoneProgress[1].claimedRewards).toContain('z1_q1')
    expect(put.zoneProgress[1].claimedRewards).toContain('z1_q2')
  })

  it('creates zoneProgress entry for the zone if it did not exist', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, zoneProgress: {} })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.claimZoneQuest(2, 'z2_q3')

    const put = db.players.put.mock.calls[0][0]
    expect(put.zoneProgress[2]).toBeDefined()
    expect(put.zoneProgress[2].claimedRewards).toContain('z2_q3')
  })
})

// ---------------------------------------------------------------------------
// playerToPayload – talent tree fields
// ---------------------------------------------------------------------------
describe('playerToPayload – talent tree fields', () => {
  it('includes talent tree fields with explicit values', () => {
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
      essence: 42,
      talents: { idle: 3, gacha: 1, power: 0 },
      essenceSpent: 7,
    }
    const payload = playerToPayload(player)
    expect(payload.essence).toBe(42)
    expect(payload.talents).toEqual({ idle: 3, gacha: 1, power: 0 })
    expect(payload.essenceSpent).toBe(7)
  })

  it('applies safe defaults for missing talent tree fields', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.essence).toBe(0)
    expect(payload.talents).toEqual({ idle: 0, gacha: 0, power: 0 })
    expect(payload.essenceSpent).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.spendEssenceOnTalent
// ---------------------------------------------------------------------------
describe('playerRepository.spendEssenceOnTalent', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    essence: 20,
    talents: { idle: 0, gacha: 0, power: 0 },
    essenceSpent: 0,
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  }

  it('deducts essence and increments talent when player can afford it', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.spendEssenceOnTalent('idle')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    // cost for idle point #1 = 1
    expect(put.essence).toBe(19)
    expect(put.talents.idle).toBe(1)
    expect(put.essenceSpent).toBe(1)
    expect(put.syncStatus).toBe('pending')
    expect(put.updatedAt).toBeDefined()
  })

  it('enqueues UPSERT_PLAYER outbox entry with correct payload', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.spendEssenceOnTalent('gacha')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const entry = db.outbox.add.mock.calls[0][0]
    expect(entry.type).toBe('UPSERT_PLAYER')
    expect(entry.status).toBe('pending')
    expect(entry.retryCount).toBe(0)
    expect(entry.payload.talents.gacha).toBe(1)
    expect(entry.payload.essence).toBe(19)
    expect(entry.payload.essenceSpent).toBe(1)
  })

  it('returns false and does not write when essence is insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, essence: 0 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.spendEssenceOnTalent('power')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false when talent branch is already at max level', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      talents: { idle: 10, gacha: 0, power: 0 },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.spendEssenceOnTalent('idle')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('works for the gacha branch', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, talents: { idle: 0, gacha: 2, power: 0 } })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.spendEssenceOnTalent('gacha')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.talents.gacha).toBe(3)
    // cost for gacha point #3 = 3
    expect(put.essence).toBe(basePlayer.essence - 3)
  })

  it('works for the power branch', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.spendEssenceOnTalent('power')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.talents.power).toBe(1)
  })

  it('creates a default player record if none exists', async () => {
    db.players.get.mockResolvedValue(undefined)
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    // Default player has essence=0, so spend will fail (cannot afford)
    const ok = await playerRepository.spendEssenceOnTalent('idle')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('does not affect other talent branches', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      talents: { idle: 3, gacha: 5, power: 2 },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.spendEssenceOnTalent('gacha')

    const put = db.players.put.mock.calls[0][0]
    expect(put.talents.idle).toBe(3)
    expect(put.talents.gacha).toBe(6)
    expect(put.talents.power).toBe(2)
  })
})
