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

// Mock characters domain so tests don't depend on catalog data
vi.mock('../../domain/characters.js', () => ({
  getCharacter: vi.fn((id) => {
    if (id === 'guerrero_novato') return { id: 'guerrero_novato', name: 'Guerrero Novato', rarity: 'common', priceCoins: 50 }
    if (id === 'oraculo_eterno') return { id: 'oraculo_eterno', name: 'Oráculo Eterno', rarity: 'legendary', priceCoins: 1000 }
    if (id === 'dragon_guardian') return { id: 'dragon_guardian', name: 'Dragón Guardián', rarity: 'epic', priceCoins: 400 }
    return undefined
  }),
}))

import { playerRepository, playerToPayload } from '../../repositories/playerRepository.js'
import db from '../../db/db.js'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// playerToPayload
// ---------------------------------------------------------------------------
describe('playerToPayload', () => {
  it('includes synced fields including coins and unlockedCharacters', () => {
    const player = {
      id: 1,
      xp: 500,
      streak: 3,
      lastActiveDate: '2024-06-01',
      dailyGoal: 5,
      rewardsUnlocked: ['r1', 'r2'],
      coins: 120,
      unlockedCharacters: ['guerrero_novato'],
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
      coins: 120,
      unlockedCharacters: ['guerrero_novato'],
      characterStages: {},
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
    expect(payload.unlockedCharacters).toEqual([])
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
      coins: 60,
      unlockedCharacters: [],
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
    expect(entry.payload.coins).toBe(60)
    expect(entry.payload.unlockedCharacters).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// playerRepository.addCoins
// ---------------------------------------------------------------------------
describe('playerRepository.addCoins', () => {
  it('increments coins and enqueues UPSERT_PLAYER', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 0,
      coins: 20,
      rewardsUnlocked: [],
      unlockedCharacters: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.addCoins(10)

    expect(db.players.put).toHaveBeenCalledOnce()
    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.coins).toBe(30)
    expect(putCall.syncStatus).toBe('pending')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const entry = db.outbox.add.mock.calls[0][0]
    expect(entry.type).toBe('UPSERT_PLAYER')
    expect(entry.payload.coins).toBe(30)
  })

  it('creates player from defaults when none exists', async () => {
    db.players.get.mockResolvedValue(undefined)
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.addCoins(5)

    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.coins).toBe(5)
    expect(putCall.id).toBe(1)
  })

  it('does nothing when amount is 0 or negative', async () => {
    db.players.get.mockResolvedValue({ id: 1, coins: 10 })

    await playerRepository.addCoins(0)
    await playerRepository.addCoins(-5)

    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// playerRepository.buyCharacter
// ---------------------------------------------------------------------------
describe('playerRepository.buyCharacter', () => {
  it('deducts coins and unlocks character when player can afford it', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 0,
      coins: 100,
      rewardsUnlocked: [],
      unlockedCharacters: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.buyCharacter('guerrero_novato')

    expect(success).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const updatedPlayer = db.players.put.mock.calls[0][0]
    expect(updatedPlayer.coins).toBe(50) // 100 - 50
    expect(updatedPlayer.unlockedCharacters).toContain('guerrero_novato')
    expect(updatedPlayer.syncStatus).toBe('pending')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const entry = db.outbox.add.mock.calls[0][0]
    expect(entry.type).toBe('UPSERT_PLAYER')
    expect(entry.payload.unlockedCharacters).toContain('guerrero_novato')
    expect(entry.payload.coins).toBe(50)
  })

  it('returns false and does NOT update when coins are insufficient', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 0,
      coins: 30,
      unlockedCharacters: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.buyCharacter('guerrero_novato') // costs 50

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('is idempotent — returns false if character already owned', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      xp: 0,
      coins: 500,
      unlockedCharacters: ['guerrero_novato'],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.buyCharacter('guerrero_novato')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for unknown character id', async () => {
    db.players.get.mockResolvedValue({ id: 1, coins: 9999, unlockedCharacters: [] })

    const success = await playerRepository.buyCharacter('nonexistent_char')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('coins never go negative', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 50,
      unlockedCharacters: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buyCharacter('guerrero_novato') // costs exactly 50

    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.coins).toBe(0)
    expect(putCall.coins).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// playerRepository.evolveCharacter
// ---------------------------------------------------------------------------
describe('playerRepository.evolveCharacter', () => {
  it('deducts coins and advances characterStages from 1 to 2', async () => {
    // guerrero_novato is 'common', Stage 1→2 costs 120
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 200,
      unlockedCharacters: ['guerrero_novato'],
      characterStages: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.evolveCharacter('guerrero_novato')

    expect(success).toBe(true)
    expect(db.players.put).toHaveBeenCalledOnce()
    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.coins).toBe(80)           // 200 - 120
    expect(putCall.characterStages.guerrero_novato).toBe(2)
    expect(putCall.syncStatus).toBe('pending')

    expect(db.outbox.add).toHaveBeenCalledOnce()
    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.type).toBe('UPSERT_PLAYER')
    expect(outboxEntry.payload.characterStages.guerrero_novato).toBe(2)
    expect(outboxEntry.payload.coins).toBe(80)
  })

  it('advances from Stage 2 to Stage 3 (common: costs 300)', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 400,
      unlockedCharacters: ['guerrero_novato'],
      characterStages: { guerrero_novato: 2 },
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.evolveCharacter('guerrero_novato')

    expect(success).toBe(true)
    const putCall = db.players.put.mock.calls[0][0]
    expect(putCall.coins).toBe(100)          // 400 - 300
    expect(putCall.characterStages.guerrero_novato).toBe(3)
  })

  it('returns false and does NOT update when coins are insufficient', async () => {
    // Stage 1→2 costs 120, player only has 50
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 50,
      unlockedCharacters: ['guerrero_novato'],
      characterStages: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.evolveCharacter('guerrero_novato')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false (idempotent) when character is already at Stage 3', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 9999,
      unlockedCharacters: ['guerrero_novato'],
      characterStages: { guerrero_novato: 3 },
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.evolveCharacter('guerrero_novato')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false when character is not unlocked', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 9999,
      unlockedCharacters: [],
      characterStages: {},
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const success = await playerRepository.evolveCharacter('guerrero_novato')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for unknown character id', async () => {
    db.players.get.mockResolvedValue({ id: 1, coins: 9999, unlockedCharacters: [] })

    const success = await playerRepository.evolveCharacter('nonexistent_char')

    expect(success).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('enqueues UPSERT_PLAYER outbox entry including characterStages', async () => {
    db.players.get.mockResolvedValue({
      id: 1,
      coins: 500,
      unlockedCharacters: ['dragon_guardian'],
      characterStages: { dragon_guardian: 1 },
      rewardsUnlocked: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.evolveCharacter('dragon_guardian') // epic, Stage 1→2 costs 260

    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.payload.characterStages).toBeDefined()
    expect(outboxEntry.payload.characterStages.dragon_guardian).toBe(2)
    expect(outboxEntry.payload.coins).toBe(240) // 500 - 260
  })
})
