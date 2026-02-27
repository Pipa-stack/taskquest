import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  isOnboardingDone,
  getOnboardingStep,
  getCurrentStepDef,
  detectOnboardingProgress,
} from '../../domain/onboarding.js'

const TODAY = '2024-06-15'

// ── ONBOARDING_STEPS catalog ─────────────────────────────────────────────────

describe('ONBOARDING_STEPS catalog', () => {
  it('has exactly 3 steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3)
    expect(ONBOARDING_TOTAL).toBe(3)
  })

  it('step numbers are 1, 2, 3', () => {
    expect(ONBOARDING_STEPS.map((s) => s.step)).toEqual([1, 2, 3])
  })

  it('each step has title, description, and hint', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.title).toBe('string')
      expect(step.title.length).toBeGreaterThan(0)
      expect(typeof step.description).toBe('string')
      expect(typeof step.hint).toBe('string')
    }
  })
})

// ── isOnboardingDone ─────────────────────────────────────────────────────────

describe('isOnboardingDone', () => {
  it('returns false for new player (onboardingDone undefined)', () => {
    expect(isOnboardingDone({})).toBe(false)
  })

  it('returns false when onboardingDone is false', () => {
    expect(isOnboardingDone({ onboardingDone: false })).toBe(false)
  })

  it('returns true when onboardingDone is true', () => {
    expect(isOnboardingDone({ onboardingDone: true })).toBe(true)
  })
})

// ── getOnboardingStep ────────────────────────────────────────────────────────

describe('getOnboardingStep', () => {
  it('defaults to 1 for a new player', () => {
    expect(getOnboardingStep({})).toBe(1)
  })

  it('returns the stored step', () => {
    expect(getOnboardingStep({ onboardingStep: 2 })).toBe(2)
    expect(getOnboardingStep({ onboardingStep: 3 })).toBe(3)
  })

  it('clamps to 1 for step < 1', () => {
    expect(getOnboardingStep({ onboardingStep: 0 })).toBe(1)
    expect(getOnboardingStep({ onboardingStep: -5 })).toBe(1)
  })

  it('clamps to ONBOARDING_TOTAL for step > total', () => {
    expect(getOnboardingStep({ onboardingStep: 99 })).toBe(ONBOARDING_TOTAL)
  })
})

// ── getCurrentStepDef ────────────────────────────────────────────────────────

describe('getCurrentStepDef', () => {
  it('returns step 1 definition for new player', () => {
    const def = getCurrentStepDef({})
    expect(def.step).toBe(1)
  })

  it('returns correct definition for step 2', () => {
    const def = getCurrentStepDef({ onboardingStep: 2 })
    expect(def.step).toBe(2)
  })

  it('returns correct definition for step 3', () => {
    const def = getCurrentStepDef({ onboardingStep: 3 })
    expect(def.step).toBe(3)
  })
})

// ── detectOnboardingProgress ─────────────────────────────────────────────────

describe('detectOnboardingProgress', () => {
  const base = {
    totalTasksCreated: 0,
    totalTasksDone:    0,
    lastIdleClaimDate: null,
    lastGachaPullDate: null,
    today: TODAY,
  }

  it('stays at step 1 when no tasks created', () => {
    expect(detectOnboardingProgress({ ...base, step: 1 })).toBe(1)
  })

  it('advances from step 1 to 2 when a task is created', () => {
    expect(detectOnboardingProgress({ ...base, step: 1, totalTasksCreated: 1 })).toBe(2)
  })

  it('stays at step 2 when tasks created but none done', () => {
    expect(detectOnboardingProgress({ ...base, step: 2, totalTasksCreated: 1, totalTasksDone: 0 })).toBe(2)
  })

  it('advances from step 2 to 3 when a task is completed', () => {
    expect(detectOnboardingProgress({ ...base, step: 2, totalTasksCreated: 1, totalTasksDone: 1 })).toBe(3)
  })

  it('stays at step 3 when idle claimed but no gacha pull', () => {
    expect(detectOnboardingProgress({
      ...base, step: 3,
      lastIdleClaimDate: TODAY,
      lastGachaPullDate: null,
    })).toBe(3)
  })

  it('stays at step 3 when gacha pulled but no idle claim', () => {
    expect(detectOnboardingProgress({
      ...base, step: 3,
      lastIdleClaimDate: null,
      lastGachaPullDate: TODAY,
    })).toBe(3)
  })

  it('returns null (done) when step 3 conditions both met on same day', () => {
    expect(detectOnboardingProgress({
      ...base, step: 3,
      lastIdleClaimDate: TODAY,
      lastGachaPullDate: TODAY,
    })).toBe(null)
  })

  it('stays at step 3 when idle/gacha dates are from a previous day', () => {
    expect(detectOnboardingProgress({
      ...base, step: 3,
      lastIdleClaimDate: '2024-06-14',
      lastGachaPullDate: '2024-06-14',
    })).toBe(3)
  })
})
