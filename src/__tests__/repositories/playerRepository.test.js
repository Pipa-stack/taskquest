/**
 * playerRepository tests — focuses on spendXp XP-safety guarantees.
 * The DB is fully mocked: no IndexedDB or Dexie instance required.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Hoist mock builders so vi.mock factory can reference them
const { getFn, putFn, transactionFn } = vi.hoisted(() => {
  const getFn = vi.fn()
  const putFn = vi.fn()
  // Execute the callback synchronously so the logic under test runs inline
  const transactionFn = vi.fn((_mode, _tables, fn) => fn())
  return { getFn, putFn, transactionFn }
})

vi.mock('../../db/db.js', () => ({
  default: {
    players: { get: getFn, put: putFn },
    transaction: transactionFn,
    tasks: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    },
  },
}))

import { spendXp } from '../../repositories/playerRepository.js'

describe('playerRepository.spendXp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionFn.mockImplementation((_mode, _tables, fn) => fn())
    putFn.mockResolvedValue(undefined)
  })

  it('deducts XP and records the reward when player can afford it', async () => {
    getFn.mockResolvedValue({ id: 1, xp: 500, rewardsUnlocked: [] })

    await spendXp(200, 'coffee_break')

    expect(putFn).toHaveBeenCalledWith(
      expect.objectContaining({ xp: 300, rewardsUnlocked: ['coffee_break'] })
    )
  })

  it('does not spend XP when balance is insufficient (prevents negative XP)', async () => {
    getFn.mockResolvedValue({ id: 1, xp: 100, rewardsUnlocked: [] })

    await spendXp(500, 'expensive_reward')

    expect(putFn).not.toHaveBeenCalled()
  })

  it('does not spend XP when cost equals zero and reward is already unlocked', async () => {
    getFn.mockResolvedValue({ id: 1, xp: 1000, rewardsUnlocked: ['coffee_break'] })

    await spendXp(200, 'coffee_break')

    expect(putFn).not.toHaveBeenCalled()
  })

  it('xp cannot go negative: exact-budget purchase works, over-budget does not', async () => {
    getFn.mockResolvedValue({ id: 1, xp: 200, rewardsUnlocked: [] })

    // Exact budget: should succeed
    await spendXp(200, 'reward_a')
    expect(putFn).toHaveBeenCalledWith(expect.objectContaining({ xp: 0 }))

    putFn.mockClear()
    getFn.mockResolvedValue({ id: 1, xp: 199, rewardsUnlocked: [] })

    // One XP short: should not update
    await spendXp(200, 'reward_b')
    expect(putFn).not.toHaveBeenCalled()
  })

  it('uses PLAYER_DEFAULTS when no player record exists yet', async () => {
    getFn.mockResolvedValue(undefined)

    // Default player has 0 xp, so any cost > 0 should be blocked
    await spendXp(100, 'some_reward')
    expect(putFn).not.toHaveBeenCalled()
  })
})
