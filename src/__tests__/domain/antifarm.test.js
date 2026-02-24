import { describe, it, expect } from 'vitest'
import { isClone } from '../../domain/antifarm.js'

const TODAY = '2026-02-24'
const TOMORROW = '2026-02-25'

const existing = [
  { id: 1, title: 'Go running', dueDate: TODAY },
  { id: 2, title: 'Read a book', dueDate: TODAY },
  { id: 3, title: 'Go running', dueDate: TOMORROW }, // same title, different day
]

describe('isClone', () => {
  it('returns false when there are no existing tasks', () => {
    expect(isClone({ title: 'Anything', dueDate: TODAY }, [])).toBe(false)
  })

  it('returns true for an exact title+date duplicate', () => {
    expect(isClone({ title: 'Go running', dueDate: TODAY }, existing)).toBe(true)
  })

  it('detects duplicates case-insensitively (UPPER)', () => {
    expect(isClone({ title: 'GO RUNNING', dueDate: TODAY }, existing)).toBe(true)
  })

  it('detects duplicates case-insensitively (mixed)', () => {
    expect(isClone({ title: 'Go Running', dueDate: TODAY }, existing)).toBe(true)
  })

  it('trims leading/trailing whitespace before comparing', () => {
    expect(isClone({ title: '  go running  ', dueDate: TODAY }, existing)).toBe(
      true
    )
  })

  it('returns false for a different title on the same date', () => {
    expect(isClone({ title: 'Go swimming', dueDate: TODAY }, existing)).toBe(
      false
    )
  })

  it('returns false for the same title on a different date', () => {
    // "Go running" exists for TOMORROW but we are testing a NEW day
    const differentDay = '2026-02-26'
    expect(
      isClone({ title: 'Go running', dueDate: differentDay }, existing)
    ).toBe(false)
  })

  it('returns false for a completely new task', () => {
    expect(isClone({ title: 'Meditate', dueDate: TODAY }, existing)).toBe(false)
  })

  it('treats empty title match correctly (edge case)', () => {
    const withEmpty = [{ id: 99, title: '', dueDate: TODAY }]
    expect(isClone({ title: '', dueDate: TODAY }, withEmpty)).toBe(true)
    expect(isClone({ title: '   ', dueDate: TODAY }, withEmpty)).toBe(true)
  })
})
