import { motion } from 'framer-motion'

/**
 * Floating "+XX XP" text that appears near the Done button and floats up.
 * Rendered inside a `position: relative` container.
 * @param {{ xp: number, onDone: () => void }} props
 */
export default function XpBurst({ xp, onDone }) {
  return (
    <motion.span
      className="xp-burst"
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -44, scale: 1.25 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      aria-hidden="true"
    >
      +{xp} XP
    </motion.span>
  )
}
