import { useState } from 'react'

/**
 * Renders today's task list with completion buttons.
 *
 * Double-click guard: each task gets its own entry in the `completing` Set.
 * While a task's completion is in flight, its button is disabled and shows
 * "Saving…" to give the user clear feedback.
 *
 * @param {{
 *   tasks: Array<{ id: number, title: string, status: string, isClone: boolean }>,
 *   onComplete: (id: number) => Promise<number>
 * }} props
 */
export default function TaskList({ tasks, onComplete }) {
  // Set of task IDs currently being saved — prevents double-click XP duplication
  const [completing, setCompleting] = useState(() => new Set())

  async function handleComplete(id) {
    if (completing.has(id)) return // already in-flight

    setCompleting((prev) => new Set(prev).add(id))
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

  if (!tasks.length) {
    return <p className="empty-state">No tasks for today. Add one above!</p>
  }

  const pending = tasks.filter((t) => t.status === 'pending')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="task-list">
      {pending.length > 0 && (
        <section>
          <h3 className="list-heading">Pending ({pending.length})</h3>
          <ul>
            {pending.map((task) => {
              const inFlight = completing.has(task.id)
              return (
                <li key={task.id} className="task-item task-pending">
                  <span className="task-title">
                    {task.title}
                    {task.isClone && (
                      <span
                        className="clone-badge"
                        title="Duplicate task — completes for 0 XP (anti-farming)"
                      >
                        clone · 0 XP
                      </span>
                    )}
                  </span>
                  <button
                    className="btn-complete"
                    onClick={() => handleComplete(task.id)}
                    disabled={inFlight}
                    aria-label={`Complete task: ${task.title}`}
                  >
                    {inFlight ? 'Saving…' : '✓ Done'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="list-heading done-heading">Done ({done.length})</h3>
          <ul>
            {done.map((task) => (
              <li key={task.id} className="task-item task-done">
                <span className="task-title">
                  {task.title}
                  {task.isClone && (
                    <span className="clone-badge">clone · 0 XP</span>
                  )}
                </span>
                <span className="done-marker">✓</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
