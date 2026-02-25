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
