import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  getOnboardingStep,
  detectOnboardingProgress,
} from '../../domain/onboarding.js'

// ── constants ─────────────────────────────────────────────────────────────────

describe('ONBOARDING_STEPS', () => {
  it('has exactly 3 steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3)
  })

  it('steps are numbered 1, 2, 3', () => {
    expect(ONBOARDING_STEPS.map((s) => s.step)).toEqual([1, 2, 3])
  })

  it('each step has title, description, and cta fields', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.title).toBe('string')
      expect(typeof step.description).toBe('string')
      expect(typeof step.cta).toBe('string')
    }
  })
})

describe('TOTAL_ONBOARDING_STEPS', () => {
  it('equals 3', () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(3)
  })
})

// ── getOnboardingStep ─────────────────────────────────────────────────────────

describe('getOnboardingStep', () => {
  it('returns the step object for step 1', () => {
    const step = getOnboardingStep(1)
    expect(step).not.toBeNull()
    expect(step.step).toBe(1)
  })

  it('returns the step object for step 2', () => {
    const step = getOnboardingStep(2)
    expect(step.step).toBe(2)
  })

  it('returns the step object for step 3', () => {
    const step = getOnboardingStep(3)
    expect(step.step).toBe(3)
  })

  it('returns null for step 0', () => {
    expect(getOnboardingStep(0)).toBeNull()
  })

  it('returns null for step 4', () => {
    expect(getOnboardingStep(4)).toBeNull()
  })
})

// ── detectOnboardingProgress ──────────────────────────────────────────────────

describe('detectOnboardingProgress', () => {
  const base = {
    onboardingDone: false,
    onboardingStep: 1,
    taskCount: 0,
    completedCount: 0,
    idleClaimed: false,
    gachaPulled: false,
  }

  it('returns null immediately when onboardingDone is true', () => {
    expect(detectOnboardingProgress({ ...base, onboardingDone: true })).toBeNull()
  })

  it('returns 1 when no tasks created yet', () => {
    expect(detectOnboardingProgress({ ...base })).toBe(1)
  })

  it('returns 2 when a task has been created but not completed', () => {
    expect(detectOnboardingProgress({ ...base, taskCount: 1 })).toBe(2)
  })

  it('returns 2 when multiple tasks created but none completed', () => {
    expect(detectOnboardingProgress({ ...base, taskCount: 3 })).toBe(2)
  })

  it('returns 2 when a task has been created and completed (step advances one at a time)', () => {
    // When stored onboardingStep=1, the function advances to 2 (step 1→2)
    // regardless of whether completedCount is also set; advances one step per call
    expect(detectOnboardingProgress({ ...base, taskCount: 1, completedCount: 1 })).toBe(2)
  })

  it('returns null when on step 3 and both idle and gacha are done', () => {
    expect(detectOnboardingProgress({
      ...base,
      onboardingStep: 3,
      taskCount: 1,
      completedCount: 1,
      idleClaimed: true,
      gachaPulled: true,
    })).toBeNull()
  })

  it('returns 3 when idle claimed but gacha not pulled yet', () => {
    expect(detectOnboardingProgress({
      ...base,
      onboardingStep: 3,
      taskCount: 1,
      completedCount: 1,
      idleClaimed: true,
      gachaPulled: false,
    })).toBe(3)
  })

  it('returns 3 when gacha pulled but idle not claimed yet', () => {
    expect(detectOnboardingProgress({
      ...base,
      onboardingStep: 3,
      taskCount: 1,
      completedCount: 1,
      idleClaimed: false,
      gachaPulled: true,
    })).toBe(3)
  })

  it('defaults onboardingStep to 1 when missing', () => {
    const params = { ...base, onboardingStep: undefined }
    expect(detectOnboardingProgress(params)).toBe(1)
  })

  it('advances from step 1 stored to step 2 when tasks exist', () => {
    expect(detectOnboardingProgress({ ...base, onboardingStep: 1, taskCount: 2 })).toBe(2)
  })

  it('advances from step 2 stored to step 3 when tasks completed', () => {
    expect(detectOnboardingProgress({ ...base, onboardingStep: 2, taskCount: 5, completedCount: 2 })).toBe(3)
  })

  it('does not regress: step 3 with no idle/gacha stays at 3', () => {
    expect(detectOnboardingProgress({
      ...base,
      onboardingStep: 3,
      taskCount: 10,
      completedCount: 5,
      idleClaimed: false,
      gachaPulled: false,
    })).toBe(3)
  })

  it('returns 2 when stored step is 1 even if all other conditions are met (one step per call)', () => {
    // The function advances one step at a time; step 1→2 is the immediate result
    // even if idle and gacha conditions are also met
    expect(detectOnboardingProgress({
      ...base,
      onboardingStep: 1,
      taskCount: 1,
      completedCount: 1,
      idleClaimed: true,
      gachaPulled: true,
    })).toBe(2)
  })
})
