import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Non-blocking overlay shown briefly when the player levels up.
 * Auto-dismisses after ~1000ms.
 * @param {{ visible: boolean, level: number, onDone: () => void }} props
 */
export default function LevelUpOverlay({ visible, level, onDone }) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDone, 1100)
    return () => clearTimeout(timer)
  }, [visible, onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="level-up-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="levelup-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="level-up-content"
            initial={{ scale: 0.7, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 1.1, y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <span className="level-up-label" aria-hidden="true">LEVEL UP!</span>
            <span className="level-up-number" id="levelup-title">Nivel {level}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
