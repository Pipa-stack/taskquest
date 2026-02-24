import { useTasks } from './hooks/useTasks.js'
import { usePlayer } from './hooks/usePlayer.js'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'
import PlayerStats from './components/PlayerStats.jsx'
import { todayKey } from './domain/dateKey.js'
import './App.css'

function App() {
  const { tasks, addTask, completeTask } = useTasks()
  const player = usePlayer()

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">TaskQuest</h1>
        <p className="app-date">Today · {todayKey()}</p>
      </header>
      <PlayerStats
        xp={player.xp}
        level={player.level}
        streak={player.streak}
        xpToNext={player.xpToNext}
      />
      <main className="app-main">
        <TaskForm onAdd={addTask} />
        <TaskList tasks={tasks} onComplete={completeTask} />
      </main>
    </div>
  )
}

export default App
