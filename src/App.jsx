import { useState, useRef, useCallback, useEffect } from 'react'
import { useTasks } from './hooks/useTasks.js'
import { usePlayer } from './hooks/usePlayer.js'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'
import PlayerStats from './components/PlayerStats.jsx'
import LevelUpOverlay from './components/LevelUpOverlay.jsx'
import Notifications from './components/Notifications.jsx'
import { todayKey } from './domain/dateKey.js'
import { xpToLevel } from './domain/gamification.js'
import './App.css'

let notifIdCounter = 0

function App() {
  const { tasks, addTask, completeTask } = useTasks()
  const player = usePlayer()

  const [showLevelUp, setShowLevelUp] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Keep a ref of current XP so handleComplete can read it synchronously
  const playerXpRef = useRef(player.xp)
  useEffect(() => {
    playerXpRef.current = player.xp
  }, [player.xp])

  const addNotification = useCallback((message) => {
    const id = ++notifIdCounter
    setNotifications((prev) => [...prev, { id, message }])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleComplete = useCallback(
    async (taskId) => {
      const prevXp = playerXpRef.current
      const prevLevel = xpToLevel(prevXp)

      const xpEarned = await completeTask(taskId)

      if (xpEarned > 0) {
        const newLevel = xpToLevel(prevXp + xpEarned)
        if (newLevel > prevLevel) {
          setShowLevelUp(true)
          addNotification(`LEVEL UP! Ahora eres nivel ${newLevel} 🎉`)
        }
        addNotification(`+${xpEarned} XP`)
      }

      return xpEarned
    },
    [completeTask, addNotification]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">TaskQuest</h1>
        <p className="app-date">Hoy · {todayKey()}</p>
      </header>

      <div className="app-layout">
        <main className="app-main">
          <TaskForm onAdd={addTask} />
          <TaskList tasks={tasks} onComplete={handleComplete} />
        </main>

        <aside className="app-sidebar">
          <PlayerStats
            xp={player.xp}
            level={player.level}
            streak={player.streak}
            xpToNext={player.xpToNext}
          />
        </aside>
      </div>

      <LevelUpOverlay
        visible={showLevelUp}
        level={player.level}
        onDone={() => setShowLevelUp(false)}
      />

      <Notifications
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  )
}

export default App
