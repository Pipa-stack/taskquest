import { useState } from 'react'
import Button from '../ui/Button.jsx'

const DIFFICULTIES = [
  { id: 'easy',   label: 'Fácil',   cls: 'diff-easy' },
  { id: 'normal', label: 'Normal',  cls: 'diff-normal' },
  { id: 'hard',   label: 'Difícil', cls: 'diff-hard' },
]

/**
 * Form to create a new task.
 * Includes a difficulty segmented control (UI-only; difficulty is not stored in the backend yet).
 */
export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState('normal')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onAdd(trimmed)
      setTitle('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="task-form-wrapper">
      {/* Difficulty segmented control */}
      <div className="difficulty-control" role="group" aria-label="Dificultad de la tarea">
        {DIFFICULTIES.map(({ id, label, cls }) => (
          <button
            key={id}
            type="button"
            className={`diff-btn ${cls} ${difficulty === id ? 'diff-active' : ''}`}
            onClick={() => setDifficulty(id)}
            aria-pressed={difficulty === id}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input + submit */}
      <form className="task-form" onSubmit={handleSubmit}>
        <div className="task-input-wrap">
          <span className="task-input-icon" aria-hidden="true">✏️</span>
          <input
            className="task-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nueva tarea para hoy…"
            disabled={busy}
            aria-label="Título de la nueva tarea"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          type="submit"
          disabled={!title.trim() || busy}
          aria-label="Añadir tarea"
        >
          {busy ? '…' : '+ Añadir'}
        </Button>
      </form>
    </div>
  )
}
