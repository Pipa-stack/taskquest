/**
 * Onboarding domain logic for TaskQuest.
 *
 * 3-step onboarding shown to new players:
 *   Step 1: Create your first task
 *   Step 2: Complete a task
 *   Step 3: Claim idle coins and do a gacha pull
 *
 * Auto-advances based on player state + live task counts.
 * Once completed (or skipped), onboardingDone = true (never shown again).
 *
 * All functions are pure (no side effects, no DB access).
 */

export const ONBOARDING_STEPS = [
  {
    step: 1,
    title: '¡Bienvenido a TaskQuest!',
    description: 'Crea tu primera tarea para empezar tu aventura. Escribe algo que quieras hacer hoy.',
    cta: 'Ir a tareas',
    condition: 'task_created',
  },
  {
    step: 2,
    title: '¡Completa una tarea!',
    description: 'Marca una tarea como completada para ganar XP y avanzar en tu aventura.',
    cta: 'Ver tareas',
    condition: 'task_completed',
  },
  {
    step: 3,
    title: '¡Idle y Gacha!',
    description: 'Reclama tus monedas idle y haz tu primer pull gacha para desbloquear personajes.',
    cta: 'Ver colección',
    condition: 'idle_and_gacha',
  },
]

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length

/**
 * Returns the step object for a given step number (1-indexed).
 *
 * @param {number} step
 * @returns {object|null}
 */
export function getOnboardingStep(step) {
  return ONBOARDING_STEPS.find((s) => s.step === step) ?? null
}

/**
 * Detects how far the player has progressed in the onboarding flow
 * and returns the step they should currently be on (1–3), or null if done.
 *
 * Auto-advances:
 *   - Step 1 → 2 when taskCount >= 1 (a task was created)
 *   - Step 2 → 3 when completedCount >= 1 (a task was completed)
 *   - Step 3 → done when idleClaimed && gachaPulled today
 *
 * @param {object} params
 * @param {boolean} params.onboardingDone    – true if onboarding was completed/skipped
 * @param {number}  params.onboardingStep    – stored step (1-indexed, default 1)
 * @param {number}  params.taskCount         – total tasks ever created
 * @param {number}  params.completedCount    – total tasks ever completed
 * @param {boolean} params.idleClaimed       – idle coins claimed today
 * @param {boolean} params.gachaPulled       – gacha pull done today
 * @returns {number|null} current step (1–3) or null if onboarding done
 */
export function detectOnboardingProgress({
  onboardingDone,
  onboardingStep,
  taskCount,
  completedCount,
  idleClaimed,
  gachaPulled,
}) {
  if (onboardingDone) return null

  const current = onboardingStep ?? 1

  // Step 1 → 2: a task was created
  if (current <= 1 && taskCount >= 1) return 2

  // Step 2 → 3: a task was completed
  if (current <= 2 && completedCount >= 1) return 3

  // Step 3 → done: idle claimed + gacha pulled
  if (current <= 3 && idleClaimed && gachaPulled) return null

  return current
}
