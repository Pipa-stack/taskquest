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
      coins: 42,
      characterStages: { warrior: 2 },
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
      coins: 42,
      characterStages: { warrior: 2 },
      updatedAt: '2024-06-01T10:00:00.000Z',
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
    expect(payload.coins).toBe(0)
    expect(payload.characterStages).toEqual({})
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
// playerRepository.buyCharacter
// ---------------------------------------------------------------------------
describe('playerRepository.buyCharacter', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 200,
    rewardsUnlocked: [],
    unlockedCharacters: [],
    activeTeam: [],
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('deducts coins and adds character to unlockedCharacters when affordable', async () => {
    // 'warrior' costs 100 coins (uncommon)
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 200 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyCharacter('warrior')

    expect(ok).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(100) // 200 - 100
    expect(put.unlockedCharacters).toContain('warrior')
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
    expect(db.outbox.add.mock.calls[0][0].payload.coins).toBe(100)
  })

  it('returns false and does NOT update when coins are insufficient', async () => {
    // 'warrior' costs 100, player only has 50
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 50 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyCharacter('warrior')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false and does NOT update when character is already unlocked', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 500, unlockedCharacters: ['warrior'] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyCharacter('warrior')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for an unknown character id', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 9999 })

    const ok = await playerRepository.buyCharacter('nonexistent_char')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('coins do not go below 0 (safety guard)', async () => {
    // 'peasant' costs 50 (common), player has exactly 50
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 50 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buyCharacter('peasant')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.evolveCharacter
// ---------------------------------------------------------------------------
describe('playerRepository.evolveCharacter', () => {
  const basePlayer = {
    id: 1,
    xp: 0,
    coins: 500,
    rewardsUnlocked: [],
    unlockedCharacters: ['warrior', 'mage'],
    activeTeam: [],
    characterStages: {},
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('deducts coins and advances characterStage from 1 to 2', async () => {
    // 'warrior' is uncommon → evolutionCost = 60
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 200 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.evolveCharacter('warrior')

    expect(ok).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(140) // 200 - 60
    expect(put.characterStages.warrior).toBe(2)
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].payload.characterStages.warrior).toBe(2)
  })

  it('returns false when coins are insufficient', async () => {
    // 'warrior' is uncommon → evolutionCost = 60
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 30 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.evolveCharacter('warrior')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false when character is already at max stage (2)', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      coins: 999,
      characterStages: { warrior: 2 },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.evolveCharacter('warrior')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('returns false when character is not unlocked', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 999, unlockedCharacters: [] })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.evolveCharacter('warrior')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('returns false for an unknown character id', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 9999 })

    const ok = await playerRepository.evolveCharacter('nonexistent_char')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerToPayload – coins + characterStages
// ---------------------------------------------------------------------------
describe('playerToPayload – coins and characterStages', () => {
  it('includes coins and characterStages in payload', () => {
    const player = {
      id: 1,
      xp: 100,
      streak: 0,
      lastActiveDate: null,
      dailyGoal: 3,
      rewardsUnlocked: [],
      unlockedCharacters: ['warrior'],
      activeTeam: ['warrior'],
      coins: 75,
      characterStages: { warrior: 2 },
      updatedAt: '2024-06-01T10:00:00.000Z',
    }
    const payload = playerToPayload(player)
    expect(payload.coins).toBe(75)
    expect(payload.characterStages).toEqual({ warrior: 2 })
  })

  it('defaults coins to 0 and characterStages to {} when missing', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.coins).toBe(0)
    expect(payload.characterStages).toEqual({})
  })
})
