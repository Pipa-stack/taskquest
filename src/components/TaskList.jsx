import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XP_PER_TASK } from '../domain/gamification.js'
import CompletedSection from './CompletedSection.jsx'
import XpBurst from './XpBurst.jsx'

/**
 * Renders today's task list.
 *
 * Pending tasks use AnimatePresence for enter/exit animations.
 * Completing a task shows an XpBurst near the button before it moves to done.
 * Done tasks are shown in a collapsible CompletedSection.
 *
 * @param {{
 *   tasks: Array<{ id: number, title: string, status: string, isClone: boolean }>,
 *   onComplete: (id: number) => Promise<number>
 * }} props
 */
export default function TaskList({ tasks, onComplete }) {
  const [completing, setCompleting] = useState(() => new Set())
  // { [taskId]: xp } – active XP bursts waiting to animate out
  const [bursts, setBursts] = useState({})

  async function handleComplete(id) {
    if (completing.has(id)) return

    // Determine XP optimistically from current task data
    const task = tasks.find((t) => t.id === id)
    const expectedXp = task?.isClone ? 0 : XP_PER_TASK

    setCompleting((prev) => new Set(prev).add(id))

    // Show burst immediately while task is still in pending list
    if (expectedXp > 0) {
      setBursts((prev) => ({ ...prev, [id]: expectedXp }))
    }

    try {
      await onComplete(id)
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function clearBurst(id) {
    setBursts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  if (!tasks.length) {
    return (
      <div className="empty-state">
        <p className="empty-text">Sin tareas para hoy.</p>
        <p className="empty-cta">Añade una tarea arriba para comenzar tu quest!</p>
      </div>
    )
  }

  const pending = tasks.filter((t) => t.status === 'pending')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="task-list">
      {pending.length > 0 && (
        <section>
          <h3 className="list-heading">Pendientes ({pending.length})</h3>
          <ul>
            <AnimatePresence initial={false}>
              {pending.map((task) => {
                const inFlight = completing.has(task.id)
                const burstXp = bursts[task.id]
                return (
                  <motion.li
                    key={task.id}
                    className="task-item task-pending"
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, scale: 0.96 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <span className="task-title">
                      {task.title}
                      {task.isClone && (
                        <span
                          className="clone-badge"
                          title="Tarea duplicada — 0 XP (anti-farming)"
                        >
                          clone · 0 XP
                        </span>
                      )}
                    </span>

                    <div className="task-actions">
                      <motion.button
                        className="btn-complete"
                        onClick={() => handleComplete(task.id)}
                        disabled={inFlight}
                        whileHover={{ scale: 1.07 }}
                        whileTap={{ scale: 0.88 }}
                        aria-label={`Completar tarea: ${task.title}`}
                      >
                        {inFlight ? 'Guardando…' : '✓ Done'}
                      </motion.button>
                      {burstXp && (
                        <XpBurst xp={burstXp} onDone={() => clearBurst(task.id)} />
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {pending.length === 0 && done.length > 0 && (
        <p className="all-done-message">¡Todo listo por hoy! 🎯</p>
      )}

      <CompletedSection tasks={done} />
    </div>
  )
}
