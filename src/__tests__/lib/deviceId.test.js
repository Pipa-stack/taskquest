import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getDeviceId', () => {
  let store
  let getDeviceId

  beforeEach(async () => {
    store = {}

    vi.stubGlobal('localStorage', {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => {
        store[key] = value
      },
      removeItem: (key) => {
        delete store[key]
      },
    })

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'mocked-uuid-abcd-1234'),
    })

    // Reset module cache so each test gets a fresh import
    vi.resetModules()
    const mod = await import('../../lib/deviceId.js')
    getDeviceId = mod.getDeviceId
  })

  it('generates a UUID and persists it on first call', () => {
    const id = getDeviceId()
    expect(id).toBe('mocked-uuid-abcd-1234')
    expect(store['taskquest.deviceId']).toBe('mocked-uuid-abcd-1234')
  })

  it('returns the existing UUID on subsequent calls without regenerating', () => {
    store['taskquest.deviceId'] = 'pre-existing-uuid'
    const id = getDeviceId()
    expect(id).toBe('pre-existing-uuid')
    // crypto.randomUUID should NOT have been called
    expect(crypto.randomUUID).not.toHaveBeenCalled()
  })

  it('returns the same value on two consecutive calls', () => {
    const id1 = getDeviceId()
    const id2 = getDeviceId()
    expect(id1).toBe(id2)
  })

  it('uses localStorage key "taskquest.deviceId"', () => {
    getDeviceId()
    expect(Object.keys(store)).toContain('taskquest.deviceId')
  })
})
