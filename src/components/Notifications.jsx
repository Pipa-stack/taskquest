import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AUTO_DISMISS_MS = 2000

/**
 * Queue-based notification system. Shows one notification at a time in order.
 * Each notification auto-dismisses after 2 seconds, then the next shows.
 *
 * @param {{
 *   notifications: Array<{ id: number, message: string }>,
 *   onDismiss: (id: number) => void
 * }} props
 */
export default function Notifications({ notifications, onDismiss }) {
  const current = notifications[0]
  const currentId = current?.id

  useEffect(() => {
    if (currentId == null) return
    const timer = setTimeout(() => onDismiss(currentId), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [currentId, onDismiss])

  return (
    <div className="notifications-container" aria-live="polite" aria-atomic="false">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            className="notification"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ duration: 0.22 }}
            onClick={() => onDismiss(current.id)}
            role="status"
          >
            {current.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
