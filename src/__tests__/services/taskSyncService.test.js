import { describe, it, expect } from 'vitest'
import { shouldOverwrite } from '../../services/taskSyncService.js'

describe('shouldOverwrite', () => {
  it('returns true when local updatedAt is null', () => {
    expect(shouldOverwrite(null, '2024-06-01T12:00:00.000Z')).toBe(true)
  })

  it('returns true when local updatedAt is undefined', () => {
    expect(shouldOverwrite(undefined, '2024-06-01T12:00:00.000Z')).toBe(true)
  })

  it('returns true when remote is more recent than local', () => {
    expect(
      shouldOverwrite('2024-06-01T10:00:00.000Z', '2024-06-01T12:00:00.000Z')
    ).toBe(true)
  })

  it('returns false when local is more recent than remote', () => {
    expect(
      shouldOverwrite('2024-06-01T12:00:00.000Z', '2024-06-01T10:00:00.000Z')
    ).toBe(false)
  })

  it('returns false when timestamps are identical (no overwrite needed)', () => {
    expect(
      shouldOverwrite('2024-06-01T10:00:00.000Z', '2024-06-01T10:00:00.000Z')
    ).toBe(false)
  })

  it('correctly compares ISO strings across date boundaries', () => {
    expect(
      shouldOverwrite('2024-01-31T23:59:59.000Z', '2024-02-01T00:00:01.000Z')
    ).toBe(true)
    expect(
      shouldOverwrite('2024-02-01T00:00:01.000Z', '2024-01-31T23:59:59.000Z')
    ).toBe(false)
  })
})
