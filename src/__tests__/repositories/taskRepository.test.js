/**
 * taskRepository tests — focuses on getRange edge cases.
 * The DB is fully mocked: no IndexedDB or Dexie instance required.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Hoist mock builders so vi.mock factory can reference them
const { toArrayFn, betweenFn, whereFn } = vi.hoisted(() => {
  const toArrayFn = vi.fn()
  const betweenFn = vi.fn()
  const whereFn = vi.fn()

  betweenFn.mockReturnValue({ toArray: toArrayFn })
  whereFn.mockReturnValue({ between: betweenFn })

  return { toArrayFn, betweenFn, whereFn }
})

vi.mock('../../db/db.js', () => ({
  default: {
    tasks: { where: whereFn },
    players: { get: vi.fn(), put: vi.fn() },
    transaction: vi.fn((_m, _t, fn) => fn()),
  },
}))

import { getRange } from '../../repositories/taskRepository.js'

describe('taskRepository.getRange', () => {
  beforeEach(() => {
    toArrayFn.mockReset()
    betweenFn.mockReturnValue({ toArray: toArrayFn })
    whereFn.mockReturnValue({ between: betweenFn })
  })

  it('queries dueDate between startKey and endKey inclusive', async () => {
    toArrayFn.mockResolvedValue([])
    await getRange('2026-02-01', '2026-02-07')

    expect(whereFn).toHaveBeenCalledWith('dueDate')
    expect(betweenFn).toHaveBeenCalledWith('2026-02-01', '2026-02-07', true, true)
  })

  it('returns tasks within the range', async () => {
    const tasks = [
      { id: 1, dueDate: '2026-02-01', status: 'done' },
      { id: 2, dueDate: '2026-02-05', status: 'pending' },
    ]
    toArrayFn.mockResolvedValue(tasks)

    const result = await getRange('2026-02-01', '2026-02-07')
    expect(result).toEqual(tasks)
  })

  it('returns empty array when no tasks fall in range', async () => {
    toArrayFn.mockResolvedValue([])

    const result = await getRange('2026-03-01', '2026-03-31')
    expect(result).toEqual([])
  })

  it('handles a single-day range (startKey === endKey)', async () => {
    const tasks = [{ id: 3, dueDate: '2026-02-15', status: 'pending' }]
    toArrayFn.mockResolvedValue(tasks)

    const result = await getRange('2026-02-15', '2026-02-15')
    expect(betweenFn).toHaveBeenCalledWith('2026-02-15', '2026-02-15', true, true)
    expect(result).toEqual(tasks)
  })
})
