import { motion, AnimatePresence } from 'framer-motion'
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS, getOnboardingStep } from '../domain/onboarding.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * OnboardingModal — one-time tutorial overlay shown to new players.
 *
 * Displays the current onboarding step with progress dots, animated transitions,
 * and a "Skip tutorial" button.
 *
 * Props:
 *   currentStep  {number}   – active step (1–3)
 *   onSkip       {Function} – called when the player skips or finishes
 *   onNavigate   {Function} – (tabName: string) → navigate to a tab
 */
export default function OnboardingModal({ currentStep, onSkip, onNavigate }) {
  const stepData = getOnboardingStep(currentStep)
  if (!stepData) return null

  const handleSkip = async () => {
    await playerRepository.completeOnboarding()
    onSkip?.()
  }

  const handleCta = () => {
    if (stepData.cta === 'Ir a tareas') onNavigate?.('Tasks')
    else if (stepData.cta === 'Ver tareas') onNavigate?.('Tasks')
    else if (stepData.cta === 'Ver colección') onNavigate?.('Colección')
  }

  return (
    <AnimatePresence>
      <motion.div
        className="onboarding-overlay"
        key="onboarding-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="onboarding-modal"
          key={`step-${currentStep}`}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          {/* Progress dots */}
          <div className="onboarding-dots">
            {Array.from({ length: TOTAL_ONBOARDING_STEPS }, (_, i) => (
              <span
                key={i}
                className={`onboarding-dot ${i + 1 === currentStep ? 'dot-active' : i + 1 < currentStep ? 'dot-done' : ''}`}
              />
            ))}
          </div>

          <div className="onboarding-step-label">Paso {currentStep} de {TOTAL_ONBOARDING_STEPS}</div>

          <h2 className="onboarding-title">{stepData.title}</h2>
          <p className="onboarding-desc">{stepData.description}</p>

          <div className="onboarding-actions">
            <button className="onboarding-cta-btn" onClick={handleCta}>
              {stepData.cta}
            </button>
            <button className="onboarding-skip-btn" onClick={handleSkip}>
              Saltar tutorial
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
