import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module before importing the repository
vi.mock('../../db/db.js', () => {
  const mockDb = {
    transaction: vi.fn(async (_mode, _tables, fn) => fn()),
    players: {
      get: vi.fn(),
      put: vi.fn(),
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

const basePlayer = {
  id: 1,
  xp: 0,
  coins: 500,
  unlockedSkins: [],
  equippedSkinByCharId: {},
  updatedAt: '2024-01-01T00:00:00.000Z',
  syncStatus: 'synced',
}

// ── playerToPayload – skins fields ──────────────────────────────────────────

describe('playerToPayload – skins fields', () => {
  it('includes unlockedSkins and equippedSkinByCharId in payload', () => {
    const player = {
      id: 1,
      xp: 0,
      streak: 0,
      lastActiveDate: null,
      dailyGoal: 3,
      rewardsUnlocked: [],
      unlockedCharacters: [],
      activeTeam: [],
      updatedAt: '2024-06-01T10:00:00.000Z',
      unlockedSkins: ['skin_autumn', 'skin_storm'],
      equippedSkinByCharId: { warrior: 'skin_autumn' },
    }
    const payload = playerToPayload(player)
    expect(payload.unlockedSkins).toEqual(['skin_autumn', 'skin_storm'])
    expect(payload.equippedSkinByCharId).toEqual({ warrior: 'skin_autumn' })
  })

  it('defaults unlockedSkins to [] and equippedSkinByCharId to {} when missing', () => {
    const payload = playerToPayload({ id: 1 })
    expect(payload.unlockedSkins).toEqual([])
    expect(payload.equippedSkinByCharId).toEqual({})
  })
})

// ── playerRepository.buySkin ────────────────────────────────────────────────

describe('playerRepository.buySkin', () => {
  it('deducts coins and adds skinId to unlockedSkins', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buySkin('skin_autumn') // cost 40

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(500 - 40)
    expect(put.unlockedSkins).toContain('skin_autumn')
    expect(put.syncStatus).toBe('pending')
    expect(put.updatedAt).toBeDefined()
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false and does NOT write when coins are insufficient', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 10 }) // skin costs 40
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buySkin('skin_autumn')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false when skin is already owned (no double-buy)', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: ['skin_autumn'],
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buySkin('skin_autumn')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('returns false for an unknown skin id', async () => {
    const ok = await playerRepository.buySkin('nonexistent_skin')
    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
  })

  it('enqueues UPSERT_PLAYER with unlockedSkins in payload', async () => {
    db.players.get.mockResolvedValue({ ...basePlayer })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.buySkin('skin_celestial') // epic, cost 120

    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.type).toBe('UPSERT_PLAYER')
    expect(outboxEntry.payload.unlockedSkins).toContain('skin_celestial')
    expect(outboxEntry.payload.coins).toBe(500 - 120)
  })

  it('coins never go below 0', async () => {
    // Exact cost match: 40 coins, skin costs 40
    db.players.get.mockResolvedValue({ ...basePlayer, coins: 40 })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.buySkin('skin_autumn')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.coins).toBe(0)
  })
})

// ── playerRepository.equipSkin ──────────────────────────────────────────────

describe('playerRepository.equipSkin', () => {
  it('sets equippedSkinByCharId for the character when skin is owned', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: ['skin_autumn'],
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.equipSkin('warrior', 'skin_autumn')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.equippedSkinByCharId.warrior).toBe('skin_autumn')
    expect(put.syncStatus).toBe('pending')
    expect(db.outbox.add).toHaveBeenCalledOnce()
    expect(db.outbox.add.mock.calls[0][0].type).toBe('UPSERT_PLAYER')
  })

  it('returns false when skin is not in unlockedSkins', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: [], // skin not owned
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.equipSkin('warrior', 'skin_autumn')

    expect(ok).toBe(false)
    expect(db.players.put).not.toHaveBeenCalled()
    expect(db.outbox.add).not.toHaveBeenCalled()
  })

  it('replaces a previously equipped skin for the same character', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: ['skin_autumn', 'skin_storm'],
      equippedSkinByCharId: { warrior: 'skin_autumn' },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.equipSkin('warrior', 'skin_storm')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.equippedSkinByCharId.warrior).toBe('skin_storm')
  })

  it('does not affect other characters equipped skins', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: ['skin_autumn'],
      equippedSkinByCharId: { mage: 'skin_autumn' },
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    const ok = await playerRepository.equipSkin('warrior', 'skin_autumn')

    expect(ok).toBe(true)
    const put = db.players.put.mock.calls[0][0]
    expect(put.equippedSkinByCharId.warrior).toBe('skin_autumn')
    expect(put.equippedSkinByCharId.mage).toBe('skin_autumn') // unchanged
  })

  it('enqueues UPSERT_PLAYER with equippedSkinByCharId in payload', async () => {
    db.players.get.mockResolvedValue({
      ...basePlayer,
      unlockedSkins: ['skin_void'],
    })
    db.players.put.mockResolvedValue(undefined)
    db.outbox.add.mockResolvedValue(1)

    await playerRepository.equipSkin('paladin', 'skin_void')

    const outboxEntry = db.outbox.add.mock.calls[0][0]
    expect(outboxEntry.payload.equippedSkinByCharId.paladin).toBe('skin_void')
  })

  it('returns false when characterId or skinId is missing', async () => {
    expect(await playerRepository.equipSkin('', 'skin_autumn')).toBe(false)
    expect(await playerRepository.equipSkin('warrior', '')).toBe(false)
    expect(await playerRepository.equipSkin(null, 'skin_autumn')).toBe(false)
  })
})
