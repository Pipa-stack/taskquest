/**
 * Onboarding step definitions and helpers for TaskQuest.
 *
 * Three guided steps teach new players the core idle loop.
 * Onboarding state is persisted in the player record (Dexie).
 *
 * All functions are pure (no side effects, no DB access).
 */

/** Ordered list of onboarding step definitions. */
export const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Crea tu primera tarea',
    description: 'Dirígete a la pestaña "Tareas" y añade una tarea.',
    hint: 'Pulsa el botón "+" o escribe en el campo de texto.',
  },
  {
    step: 2,
    title: 'Completa una tarea y gana coins',
    description: 'Marca la tarea como completada para ganar XP y monedas.',
    hint: 'Pulsa el check junto a la tarea.',
  },
  {
    step: 3,
    title: 'Reclama idle y abre 1 pack en Gacha',
    description: 'Reclamar idle acumula monedas pasivas. Después, abre un pack en la Gacha.',
    hint: 'Pulsa "Reclamar idle" en la Base y luego ve a la pestaña "Gacha".',
  },
]

/** Total number of onboarding steps. */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length

/**
 * Returns true if onboarding has been completed or skipped.
 *
 * @param {object} player – player record
 * @returns {boolean}
 */
export function isOnboardingDone(player) {
  return Boolean(player.onboardingDone)
}

/**
 * Returns the current onboarding step number (1-indexed).
 * Defaults to 1 for new players.
 *
 * @param {object} player – player record
 * @returns {number} 1–ONBOARDING_TOTAL
 */
export function getOnboardingStep(player) {
  const step = player.onboardingStep ?? 1
  return Math.max(1, Math.min(step, ONBOARDING_TOTAL))
}

/**
 * Returns the step definition object for the current onboarding step.
 *
 * @param {object} player – player record
 * @returns {object} step definition { step, title, description, hint }
 */
export function getCurrentStepDef(player) {
  const step = getOnboardingStep(player)
  return ONBOARDING_STEPS.find((s) => s.step === step) ?? ONBOARDING_STEPS[0]
}

/**
 * Detects the next onboarding step based on current progress.
 *
 * Step advancement rules:
 *   Step 1 → 2: Player has created at least 1 task (totalTasksCreated >= 1)
 *   Step 2 → 3: Player has completed at least 1 task (totalTasksDone >= 1)
 *   Step 3 → done: Player has claimed idle today AND done a gacha pull today
 *
 * Returns the new step number, or null when all steps are complete (done).
 *
 * @param {object} params
 * @param {number}      params.step                – current onboarding step
 * @param {number}      params.totalTasksCreated   – total tasks ever created
 * @param {number}      params.totalTasksDone      – total tasks ever completed
 * @param {string|null} params.lastIdleClaimDate   – YYYY-MM-DD of last idle claim
 * @param {string|null} params.lastGachaPullDate   – YYYY-MM-DD of last gacha pull
 * @param {string}      params.today               – today's YYYY-MM-DD key
 * @returns {number|null} next step number, or null if done
 */
export function detectOnboardingProgress({
  step,
  totalTasksCreated,
  totalTasksDone,
  lastIdleClaimDate,
  lastGachaPullDate,
  today,
}) {
  if (step === 1 && (totalTasksCreated ?? 0) >= 1) return 2
  if (step === 2 && (totalTasksDone ?? 0) >= 1) return 3
  if (step === 3 && lastIdleClaimDate === today && lastGachaPullDate === today) return null
  return step
}
