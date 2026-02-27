import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  isOnboardingDone,
  getOnboardingStep,
  getCurrentStepDef,
  detectOnboardingProgress,
} from '../domain/onboarding.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * OnboardingModal — 3-step guided tutorial shown once to new players.
 *
 * Detects step completion automatically via live Dexie queries.
 * "Saltar" button marks onboardingDone=true immediately.
 *
 * Props:
 *   player  {object} – full player record from usePlayer()
 */
export default function OnboardingModal({ player }) {
  const visible = !isOnboardingDone(player)
  if (!visible) return null

  return <OnboardingContent player={player} />
}

function OnboardingContent({ player }) {
  const today = todayKey()
  const currentStep = getOnboardingStep(player)
  const stepDef = getCurrentStepDef(player)

  // Live data needed for step detection
  const totalTasks = useLiveQuery(() => db.tasks.count(), []) ?? 0
  const totalDone  = useLiveQuery(
    () => db.tasks.where('status').equals('done').count(),
    []
  ) ?? 0

  // Auto-advance: check if current step conditions are met
  useEffect(() => {
    const nextStep = detectOnboardingProgress({
      step:               currentStep,
      totalTasksCreated:  totalTasks,
      totalTasksDone:     totalDone,
      lastIdleClaimDate:  player.lastIdleClaimDate ?? null,
      lastGachaPullDate:  player.lastGachaPullDate ?? null,
      today,
    })

    if (nextStep === currentStep) return // no change

    if (nextStep === null) {
      // All steps complete
      playerRepository.completeOnboarding().catch(console.warn)
    } else {
      // Advance to next step
      playerRepository.setOnboardingStep(nextStep).catch(console.warn)
    }
  }, [currentStep, totalTasks, totalDone, player.lastIdleClaimDate, player.lastGachaPullDate, today])

  const handleSkip = async () => {
    await playerRepository.completeOnboarding()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="onboarding-modal"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          {/* Header */}
          <div className="onboarding-header">
            <span className="onboarding-badge">Inicio</span>
            <span className="onboarding-steps-count">
              Paso {currentStep} / {ONBOARDING_TOTAL}
            </span>
          </div>

          {/* Step dots */}
          <div className="onboarding-dots">
            {ONBOARDING_STEPS.map((s) => (
              <span
                key={s.step}
                className={`onboarding-dot ${s.step === currentStep ? 'dot-active' : s.step < currentStep ? 'dot-done' : ''}`}
              />
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="onboarding-content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="onboarding-title">{stepDef.title}</h2>
              <p className="onboarding-description">{stepDef.description}</p>
              <p className="onboarding-hint">💡 {stepDef.hint}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="onboarding-progress-wrap">
            <div
              className="onboarding-progress-bar"
              style={{ width: `${Math.round(((currentStep - 1) / ONBOARDING_TOTAL) * 100)}%` }}
            />
          </div>

          {/* Skip */}
          <button
            className="onboarding-skip-btn"
            onClick={handleSkip}
            type="button"
          >
            Saltar tutorial
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
