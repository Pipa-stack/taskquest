import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Collapsible section showing completed tasks.
 * Toggle button shows/hides the list with an animated expand/collapse.
 * @param {{ tasks: Array<{ id: number, title: string, isClone: boolean }> }} props
 */
export default function CompletedSection({ tasks }) {
  const [open, setOpen] = useState(false)

  if (!tasks.length) return null

  return (
    <section className="completed-section">
      <button
        className="completed-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="completed-toggle-label">
          Completadas ({tasks.length})
        </span>
        <motion.span
          className="toggle-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          aria-hidden="true"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="completed-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                className="task-item task-done"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="task-title">
                  {task.title}
                  {task.isClone && (
                    <span className="clone-badge">clone · 0 XP</span>
                  )}
                </span>
                <span className="done-marker" aria-label="Completada">✓</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}
