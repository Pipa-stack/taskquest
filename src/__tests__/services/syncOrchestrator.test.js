import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks must be declared before imports ─────────────────────────────────────

vi.mock('../../services/taskSyncService.js', () => ({
  pushOutbox: vi.fn(),
  pullRemote: vi.fn(),
}))

vi.mock('../../services/playerSyncService.js', () => ({
  pushPlayerOutbox: vi.fn(),
  pullPlayerRemote: vi.fn(),
}))

vi.mock('../../db/db.js', () => {
  // Simulate a player record with lastSyncAt etc.
  let playerRecord = null

  const mockDb = {
    _setPlayer: (p) => { playerRecord = p },
    _getPlayer: () => playerRecord,
    players: {
      get: vi.fn(async () => playerRecord),
      update: vi.fn(async (_id, fields) => {
        if (playerRecord) Object.assign(playerRecord, fields)
      }),
      put: vi.fn(async (p) => { playerRecord = p }),
    },
    outbox: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn(async () => 0),
          modify: vi.fn(async () => {}),
        }),
      }),
      count: vi.fn(async () => 0),
    },
  }
  return { default: mockDb }
})

import {
  getBackoffInterval,
  classifyError,
  getSyncSnapshot,
  getSyncState,
  syncNow,
  resetAuthRequired,
  getAndClearMergeNote,
  _resetStateForTests,
  BACKOFF_STEPS_MS,
} from '../../services/syncOrchestrator.js'
import { pushOutbox, pullRemote } from '../../services/taskSyncService.js'
import { pushPlayerOutbox, pullPlayerRemote } from '../../services/playerSyncService.js'
import db from '../../db/db.js'

beforeEach(() => {
  vi.clearAllMocks()
  _resetStateForTests()

  // Reset player record to null for each test
  db._setPlayer(null)

  // Default: all push/pull resolve cleanly
  pushOutbox.mockResolvedValue(undefined)
  pullRemote.mockResolvedValue(undefined)
  pushPlayerOutbox.mockResolvedValue(undefined)
  pullPlayerRemote.mockResolvedValue(undefined)

  // Default outbox counts
  db.outbox.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      count: vi.fn(async () => 0),
      modify: vi.fn(async () => {}),
    }),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getBackoffInterval (pure function)
// ─────────────────────────────────────────────────────────────────────────────
describe('getBackoffInterval', () => {
  it('returns 15s for 0 consecutive errors', () => {
    expect(getBackoffInterval(0)).toBe(BACKOFF_STEPS_MS[0])
  })

  it('returns 15s for 1 consecutive error', () => {
    expect(getBackoffInterval(1)).toBe(BACKOFF_STEPS_MS[0])
  })

  it('returns 30s for 2 consecutive errors', () => {
    expect(getBackoffInterval(2)).toBe(BACKOFF_STEPS_MS[1])
  })

  it('returns 60s for 3 consecutive errors (cap)', () => {
    expect(getBackoffInterval(3)).toBe(BACKOFF_STEPS_MS[2])
  })

  it('returns 60s for 10 consecutive errors (always capped)', () => {
    expect(getBackoffInterval(10)).toBe(BACKOFF_STEPS_MS[2])
  })

  it('backoff progression is monotonically non-decreasing', () => {
    const values = [0, 1, 2, 3, 4, 5].map(getBackoffInterval)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// classifyError (pure function)
// ─────────────────────────────────────────────────────────────────────────────
describe('classifyError', () => {
  it('returns "auth" for status 401', () => {
    expect(classifyError({ status: 401 })).toBe('auth')
  })

  it('returns "auth" for status 403', () => {
    expect(classifyError({ status: 403 })).toBe('auth')
  })

  it('returns "auth" for JWT error message', () => {
    expect(classifyError({ message: 'JWT expired' })).toBe('auth')
  })

  it('returns "auth" for "unauthorized" message', () => {
    expect(classifyError({ message: 'unauthorized access' })).toBe('auth')
  })

  it('returns "network" for fetch failure message', () => {
    expect(classifyError({ message: 'Failed to fetch' })).toBe('network')
  })

  it('returns "validation" for 400-range status (non-auth)', () => {
    expect(classifyError({ status: 422 })).toBe('validation')
  })

  it('returns "unknown" for null/undefined error', () => {
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
  })

  it('returns "unknown" for unknown server error (500)', () => {
    expect(classifyError({ status: 500 })).toBe('unknown')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getSyncSnapshot
// ─────────────────────────────────────────────────────────────────────────────
describe('getSyncSnapshot', () => {
  it('returns zero counts when outbox is empty', async () => {
    const snapshot = await getSyncSnapshot(db)
    expect(snapshot.pendingCount).toBe(0)
    expect(snapshot.errorCount).toBe(0)
  })

  it('returns authRequired from state', async () => {
    // Initially false
    const snapshot = await getSyncSnapshot(db)
    expect(snapshot.authRequired).toBe(false)
  })

  it('includes consecutiveErrors from state', async () => {
    const snapshot = await getSyncSnapshot(db)
    expect(typeof snapshot.consecutiveErrors).toBe('number')
  })

  it('returns null sync timestamps when player has no meta', async () => {
    const snapshot = await getSyncSnapshot(db)
    expect(snapshot.lastSyncOkAt).toBeNull()
    expect(snapshot.lastSyncErrorAt).toBeNull()
    expect(snapshot.lastSyncErrorMessage).toBeNull()
  })

  it('returns player sync meta when player exists', async () => {
    db._setPlayer({
      id: 1,
      lastSyncOkAt: '2025-01-01T10:00:00.000Z',
      lastSyncErrorAt: null,
      lastSyncErrorMessage: null,
      lastSyncAt: '2025-01-01T10:05:00.000Z',
    })

    const snapshot = await getSyncSnapshot(db)
    expect(snapshot.lastSyncOkAt).toBe('2025-01-01T10:00:00.000Z')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// syncNow
// ─────────────────────────────────────────────────────────────────────────────
describe('syncNow', () => {
  it('returns { ok: true } when no supabase/userId provided', async () => {
    const result = await syncNow({})
    expect(result.ok).toBe(true)
  })

  it('calls pushOutbox, pushPlayerOutbox, pullRemote, pullPlayerRemote in order', async () => {
    const callOrder = []
    pushOutbox.mockImplementation(async () => callOrder.push('pushOutbox'))
    pushPlayerOutbox.mockImplementation(async () => callOrder.push('pushPlayerOutbox'))
    pullRemote.mockImplementation(async () => callOrder.push('pullRemote'))
    pullPlayerRemote.mockImplementation(async () => callOrder.push('pullPlayerRemote'))

    await syncNow({ supabase: {}, userId: 'u1', db })

    expect(callOrder).toEqual(['pushOutbox', 'pushPlayerOutbox', 'pullRemote', 'pullPlayerRemote'])
  })

  it('returns { ok: true } on successful sync', async () => {
    const result = await syncNow({ supabase: {}, userId: 'u1', db })
    expect(result.ok).toBe(true)
  })

  it('resets consecutiveErrors to 0 on success after errors', async () => {
    // First cause an error to increment counter
    pushOutbox.mockRejectedValueOnce(new Error('network error'))
    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getSyncState().consecutiveErrors).toBe(1)

    // Now succeed
    pushOutbox.mockResolvedValue(undefined)
    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getSyncState().consecutiveErrors).toBe(0)
  })

  it('sets authRequired=true on 401 error', async () => {
    pushOutbox.mockRejectedValueOnce({ status: 401, message: 'unauthorized' })
    const result = await syncNow({ supabase: {}, userId: 'u1', db })
    expect(result.ok).toBe(false)
    expect(result.errorType).toBe('auth')
    expect(getSyncState().authRequired).toBe(true)
  })

  it('stops further operations when auth error occurs (pull not called)', async () => {
    pushOutbox.mockRejectedValueOnce({ status: 401, message: 'unauthorized' })
    await syncNow({ supabase: {}, userId: 'u1', db })

    // pullRemote should NOT have been called
    expect(pullRemote).not.toHaveBeenCalled()
  })

  it('increments consecutiveErrors on repeated network failure', async () => {
    pushOutbox.mockRejectedValue({ message: 'Failed to fetch' })
    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getSyncState().consecutiveErrors).toBe(1)

    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getSyncState().consecutiveErrors).toBe(2)
  })

  it('stores error message on failure', async () => {
    pushOutbox.mockRejectedValue(new Error('network down'))
    const result = await syncNow({ supabase: {}, userId: 'u1', db })
    expect(result.errorMessage).toContain('network down')
  })

  it('resetAuthRequired clears authRequired and consecutiveErrors', async () => {
    pushOutbox.mockRejectedValueOnce({ status: 401, message: 'unauthorized' })
    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getSyncState().authRequired).toBe(true)

    resetAuthRequired()
    expect(getSyncState().authRequired).toBe(false)
    expect(getSyncState().consecutiveErrors).toBe(0)
  })

  it('getAndClearMergeNote returns null when no merge occurred', async () => {
    db._setPlayer({ id: 1, updatedAt: '2025-01-01T10:00:00.000Z' })
    // pullPlayerRemote does not change updatedAt
    await syncNow({ supabase: {}, userId: 'u1', db })
    expect(getAndClearMergeNote()).toBeNull()
  })

  it('sets pendingMergeNote when remote player overwrites local', async () => {
    // Player before pull has old updatedAt
    db._setPlayer({ id: 1, updatedAt: '2025-01-01T10:00:00.000Z' })

    // pullPlayerRemote changes the player's updatedAt (simulating remote merge)
    pullPlayerRemote.mockImplementation(async () => {
      db._setPlayer({ id: 1, updatedAt: '2025-01-02T10:00:00.000Z' })
    })

    await syncNow({ supabase: {}, userId: 'u1', db })
    const note = getAndClearMergeNote()
    expect(note).toBe('Se aplicó la versión más reciente (otro dispositivo)')
  })

  it('getAndClearMergeNote clears the note after first read', async () => {
    db._setPlayer({ id: 1, updatedAt: '2025-01-01T10:00:00.000Z' })
    pullPlayerRemote.mockImplementation(async () => {
      db._setPlayer({ id: 1, updatedAt: '2025-01-02T10:00:00.000Z' })
    })

    await syncNow({ supabase: {}, userId: 'u1', db })
    getAndClearMergeNote() // first read — returns note
    const second = getAndClearMergeNote() // second read — should be null
    expect(second).toBeNull()
  })
})
