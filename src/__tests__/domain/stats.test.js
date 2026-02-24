import { describe, it, expect } from 'vitest'
import { aggregateLast7Days, getTodayStats } from '../../domain/stats.js'

// Fixed "now" = Feb 24 2026, noon LOCAL
const NOW = new Date(2026, 1, 24, 12, 0, 0)

// Helpers to build mock tasks
const done = (dueDate, isClone = false) => ({ status: 'done', dueDate, isClone })
const pending = (dueDate) => ({ status: 'pending', dueDate, isClone: false })

describe('aggregateLast7Days', () => {
  it('returns exactly 7 rows ordered oldest → newest', () => {
    const rows = aggregateLast7Days([], NOW)
    expect(rows).toHaveLength(7)
    expect(rows[0].date).toBe('2026-02-18')
    expect(rows[6].date).toBe('2026-02-24')
  })

  it('all counts are 0 when there are no tasks', () => {
    const rows = aggregateLast7Days([], NOW)
    rows.forEach((r) => {
      expect(r.tasks).toBe(0)
      expect(r.xp).toBe(0)
    })
  })

  it('counts tasks completed today correctly', () => {
    const tasks = [
      done('2026-02-24'),
      done('2026-02-24'),
      pending('2026-02-24'),
    ]
    const rows = aggregateLast7Days(tasks, NOW)
    const today = rows.find((r) => r.date === '2026-02-24')
    expect(today.tasks).toBe(2)
    expect(today.xp).toBe(200)
  })

  it('ignores tasks outside the 7-day window', () => {
    const tasks = [
      done('2026-02-01'), // outside window
      done('2026-02-24'),
    ]
    const rows = aggregateLast7Days(tasks, NOW)
    const total = rows.reduce((acc, r) => acc + r.tasks, 0)
    expect(total).toBe(1)
  })

  it('clone tasks count as 1 task but 0 XP', () => {
    const tasks = [
      done('2026-02-24', false),  // 100 XP
      done('2026-02-24', true),   // clone: 0 XP
    ]
    const rows = aggregateLast7Days(tasks, NOW)
    const today = rows.find((r) => r.date === '2026-02-24')
    expect(today.tasks).toBe(2)
    expect(today.xp).toBe(100)
  })

  it('counts tasks across multiple days correctly', () => {
    const tasks = [
      done('2026-02-18'),
      done('2026-02-20'),
      done('2026-02-20'),
      done('2026-02-24'),
    ]
    const rows = aggregateLast7Days(tasks, NOW)
    expect(rows.find((r) => r.date === '2026-02-18').tasks).toBe(1)
    expect(rows.find((r) => r.date === '2026-02-20').tasks).toBe(2)
    expect(rows.find((r) => r.date === '2026-02-24').tasks).toBe(1)
    expect(rows.find((r) => r.date === '2026-02-19').tasks).toBe(0)
  })

  it('pending tasks are not counted', () => {
    const tasks = [pending('2026-02-24'), pending('2026-02-24')]
    const rows = aggregateLast7Days(tasks, NOW)
    const today = rows.find((r) => r.date === '2026-02-24')
    expect(today.tasks).toBe(0)
    expect(today.xp).toBe(0)
  })
})

describe('getTodayStats', () => {
  it('returns the row matching todayDate', () => {
    const rows = aggregateLast7Days([done('2026-02-24')], NOW)
    const stat = getTodayStats(rows, '2026-02-24')
    expect(stat.date).toBe('2026-02-24')
    expect(stat.tasks).toBe(1)
    expect(stat.xp).toBe(100)
  })

  it('returns zero defaults when date not found', () => {
    const stat = getTodayStats([], '2026-02-24')
    expect(stat.tasks).toBe(0)
    expect(stat.xp).toBe(0)
  })
})
