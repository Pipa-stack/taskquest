import { DIFFICULTY_LABELS } from '../domain/tasks.js'

export default function TaskCard({ task, onComplete }) {
  const done = task.status === 'completed'

  return (
    <div className={`task-card task-card--${task.difficulty} ${done ? 'task-card--done' : ''}`}>
      <button
        className={`task-card__check ${done ? 'task-card__check--done' : ''}`}
        onClick={() => !done && onComplete(task.id)}
        disabled={done}
        aria-label={done ? 'Tarea completada' : 'Marcar como completada'}
      >
        {done ? '✓' : ''}
      </button>

      <div className="task-card__body">
        <span className={`task-card__title ${done ? 'task-card__title--done' : ''}`}>
          {task.title}
        </span>
        <div className="task-card__meta">
          <span className={`diff-badge diff-badge--${task.difficulty}`}>
            {DIFFICULTY_LABELS[task.difficulty]}
          </span>
          <span className="task-card__xp">+{task.xpReward} XP</span>
        </div>
      </div>
    </div>
  )
}
