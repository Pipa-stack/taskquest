import { useState } from 'react'
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../domain/tasks.js'
import { getXpForDifficulty } from '../domain/gamification.js'

export default function TaskForm({ onAdd }) {
  const [title,      setTitle]      = useState('')
  const [difficulty, setDifficulty] = useState('medium')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title, difficulty)
    setTitle('')
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        className="task-form__input"
        type="text"
        placeholder="¿Qué quieres lograr hoy?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        autoComplete="off"
      />

      <div className="task-form__row">
        <div className="diff-selector">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`diff-btn diff-btn--${d} ${difficulty === d ? 'diff-btn--selected' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <span>{DIFFICULTY_LABELS[d]}</span>
              <span className="diff-btn__xp">+{getXpForDifficulty(d)} XP</span>
            </button>
          ))}
        </div>

        <button
          className="task-form__submit"
          type="submit"
          disabled={!title.trim()}
        >
          Añadir
        </button>
      </div>
    </form>
  )
}
