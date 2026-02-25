import { describe, it, expect } from 'vitest'
import { shouldOverwritePlayer } from '../../services/playerSyncService.js'

describe('shouldOverwritePlayer', () => {
  it('returns true when local is null (no local player)', () => {
    expect(shouldOverwritePlayer(null, { updated_at: '2024-06-01T12:00:00.000Z' })).toBe(true)
  })

  it('returns true when local is undefined', () => {
    expect(shouldOverwritePlayer(undefined, { updated_at: '2024-06-01T12:00:00.000Z' })).toBe(true)
  })

  it('returns true when local player has no updatedAt field', () => {
    expect(
      shouldOverwritePlayer({ id: 1, xp: 100 }, { updated_at: '2024-06-01T12:00:00.000Z' })
    ).toBe(true)
  })

  it('returns true when remote is more recent than local', () => {
    expect(
      shouldOverwritePlayer(
        { updatedAt: '2024-06-01T10:00:00.000Z' },
        { updated_at: '2024-06-01T12:00:00.000Z' }
      )
    ).toBe(true)
  })

  it('returns false when local is more recent than remote', () => {
    expect(
      shouldOverwritePlayer(
        { updatedAt: '2024-06-01T12:00:00.000Z' },
        { updated_at: '2024-06-01T10:00:00.000Z' }
      )
    ).toBe(false)
  })

  it('returns false when timestamps are identical (no overwrite needed)', () => {
    expect(
      shouldOverwritePlayer(
        { updatedAt: '2024-06-01T10:00:00.000Z' },
        { updated_at: '2024-06-01T10:00:00.000Z' }
      )
    ).toBe(false)
  })

  it('correctly compares ISO strings across date boundaries', () => {
    expect(
      shouldOverwritePlayer(
        { updatedAt: '2024-01-31T23:59:59.000Z' },
        { updated_at: '2024-02-01T00:00:01.000Z' }
      )
    ).toBe(true)
    expect(
      shouldOverwritePlayer(
        { updatedAt: '2024-02-01T00:00:01.000Z' },
        { updated_at: '2024-01-31T23:59:59.000Z' }
      )
    ).toBe(false)
  })
})
