import { describe, it, expect } from 'vitest'
import { shouldOverwrite, isRetryable } from '../../services/taskSyncService.js'

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

describe('isRetryable – retry selection for failed outbox items', () => {
  it('returns true for pending items', () => {
    expect(isRetryable({ status: 'pending', retryCount: 0 })).toBe(true)
  })

  it('returns true for pending items with no retryCount field', () => {
    expect(isRetryable({ status: 'pending' })).toBe(true)
  })

  it('returns true for failed items with retryCount below MAX_RETRIES (4)', () => {
    expect(isRetryable({ status: 'failed', retryCount: 0 })).toBe(true)
    expect(isRetryable({ status: 'failed', retryCount: 4 })).toBe(true)
  })

  it('returns false for failed items that have hit MAX_RETRIES (5)', () => {
    expect(isRetryable({ status: 'failed', retryCount: 5 })).toBe(false)
    expect(isRetryable({ status: 'failed', retryCount: 99 })).toBe(false)
  })

  it('returns false for sent items (already processed)', () => {
    expect(isRetryable({ status: 'sent', retryCount: 0 })).toBe(false)
  })

  it('returns false for unknown statuses', () => {
    expect(isRetryable({ status: 'unknown', retryCount: 0 })).toBe(false)
  })

  it('treats missing retryCount as 0 for failed items', () => {
    expect(isRetryable({ status: 'failed' })).toBe(true)  // 0 < 5
  })
})
