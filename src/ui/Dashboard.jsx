import { useEffect } from 'react'
import useStore      from '../app/store.js'
import PlayerHUD     from './PlayerHUD.jsx'
import TaskForm      from './TaskForm.jsx'
import TaskCard      from './TaskCard.jsx'
import Notification  from './Notification.jsx'

export default function Dashboard() {
  const {
    tasks, player, isLoading, notification,
    initialize, createTask, completeTask,
  } = useStore()

  useEffect(() => { initialize() }, [])

  if (isLoading) {
    return <div className="loading">Iniciando TaskQuest…</div>
  }

  const pending   = tasks.filter((t) => t.status === 'pending')
  const completed = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="dashboard">
      {/* ── Header sticky ── */}
      <header className="header">
        <h1 className="header__logo">TaskQuest</h1>
        <PlayerHUD player={player} />
      </header>

      {/* ── Main content ── */}
      <main className="main">
        <TaskForm onAdd={createTask} />

        <section>
          <div className="section-header">
            <h2 className="section-header__title">Hoy</h2>
            <span className="section-header__count">
              {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
              {completed.length > 0 && ` · ${completed.length} completada${completed.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="empty-state">
              Añade tu primera tarea para empezar a ganar XP ✦
            </div>
          ) : (
            <div className="task-list">
              {pending.map((t)   => <TaskCard key={t.id} task={t} onComplete={completeTask} />)}
              {completed.map((t) => <TaskCard key={t.id} task={t} onComplete={completeTask} />)}
            </div>
          )}
        </section>
      </main>

      {/* ── XP notification toast ── */}
      <Notification key={notification?.id} notification={notification} />
    </div>
  )
}
