import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// vi.hoisted: declare shared mock state before vi.mock factory executes
// (vi.mock is hoisted above imports, so ordinary let/const are not yet
//  initialized when the factory runs — vi.hoisted solves this).
// ---------------------------------------------------------------------------
const { mockBulkDelete, getFakeItems, setFakeItems } = vi.hoisted(() => {
  const mockBulkDelete = vi.fn().mockResolvedValue(undefined)
  let fakeItems = []
  return {
    mockBulkDelete,
    getFakeItems: () => fakeItems,
    setFakeItems: (items) => { fakeItems = items },
  }
})

vi.mock('../../db/db.js', () => ({
  default: {
    outbox: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn((predicate) => ({
            limit: vi.fn(() => ({
              toArray: vi.fn(() => Promise.resolve(getFakeItems().filter(predicate))),
            })),
          })),
        })),
      })),
      bulkDelete: mockBulkDelete,
    },
  },
}))

import { cleanupDeadOutbox, MAX_RETRIES } from '../../services/outboxCleanupService.js'

beforeEach(() => {
  vi.clearAllMocks()
  setFakeItems([])
})

describe('MAX_RETRIES constant', () => {
  it('is 5', () => {
    expect(MAX_RETRIES).toBe(5)
  })
})

describe('cleanupDeadOutbox', () => {
  it('deletes only dead-letter items (retryCount >= MAX_RETRIES)', async () => {
    setFakeItems([
      { id: 1, status: 'failed', retryCount: 5 },   // dead
      { id: 2, status: 'failed', retryCount: 7 },   // dead
      { id: 3, status: 'failed', retryCount: 5 },   // dead
      { id: 4, status: 'failed', retryCount: 2 },   // retryable – must NOT be deleted
    ])

    const result = await cleanupDeadOutbox()

    expect(result.deleted).toBe(3)
    expect(mockBulkDelete).toHaveBeenCalledOnce()
    expect(mockBulkDelete).toHaveBeenCalledWith([1, 2, 3])
  })

  it('returns { deleted: 0 } and skips bulkDelete when nothing qualifies', async () => {
    setFakeItems([
      { id: 10, status: 'failed', retryCount: 2 },
      { id: 11, status: 'failed', retryCount: 4 },
    ])

    const result = await cleanupDeadOutbox()

    expect(result.deleted).toBe(0)
    expect(mockBulkDelete).not.toHaveBeenCalled()
  })

  it('returns { deleted: 0 } when outbox is empty', async () => {
    setFakeItems([])
    const result = await cleanupDeadOutbox()
    expect(result.deleted).toBe(0)
    expect(mockBulkDelete).not.toHaveBeenCalled()
  })

  it('treats missing retryCount as 0 (retryable, not dead)', async () => {
    setFakeItems([{ id: 20, status: 'failed' }]) // retryCount undefined → 0 < 5
    const result = await cleanupDeadOutbox()
    expect(result.deleted).toBe(0)
  })

  it('boundary: retryCount === MAX_RETRIES - 1 is NOT deleted', async () => {
    setFakeItems([{ id: 30, status: 'failed', retryCount: MAX_RETRIES - 1 }])
    const result = await cleanupDeadOutbox()
    expect(result.deleted).toBe(0)
  })

  it('boundary: retryCount === MAX_RETRIES IS deleted', async () => {
    setFakeItems([{ id: 31, status: 'failed', retryCount: MAX_RETRIES }])
    const result = await cleanupDeadOutbox()
    expect(result.deleted).toBe(1)
    expect(mockBulkDelete).toHaveBeenCalledWith([31])
  })
})
