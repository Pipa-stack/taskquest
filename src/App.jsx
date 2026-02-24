import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTasks } from './hooks/useTasks.js'
import { usePlayer } from './hooks/usePlayer.js'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'
import PlayerStats from './components/PlayerStats.jsx'
import LevelUpOverlay from './components/LevelUpOverlay.jsx'
import Notifications from './components/Notifications.jsx'
import RewardsShop from './components/RewardsShop.jsx'
import StatsTab from './components/StatsTab.jsx'
import { todayKey } from './domain/dateKey.js'
import { xpToLevel } from './domain/gamification.js'
import { getAchievement } from './domain/achievements.js'
import './App.css'

let notifIdCounter = 0

const TABS = ['Tasks', 'Rewards', 'Stats']

function App() {
  const { tasks, addTask, completeTask } = useTasks()
  const player = usePlayer()

  const [activeTab, setActiveTab] = useState('Tasks')
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

      const { xpEarned, newAchievements } = await completeTask(taskId)

      if (xpEarned > 0) {
        const newLevel = xpToLevel(prevXp + xpEarned)
        if (newLevel > prevLevel) {
          setShowLevelUp(true)
          addNotification(`LEVEL UP! Ahora eres nivel ${newLevel} 🎉`)
        }
        addNotification(`+${xpEarned} XP`)
      }

      // Achievement notifications
      for (const id of newAchievements) {
        const achievement = getAchievement(id)
        if (achievement) {
          addNotification(`🏆 Logro desbloqueado: ${achievement.title}`)
        }
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

      {/* Tab navigation */}
      <nav className="tabs-nav" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab-btn ${activeTab === tab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Desktop: 2-column layout. Mobile: stacked */}
      <div className="app-layout">
        <main className="app-main">
          <AnimatePresence mode="wait">
            {activeTab === 'Tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <TaskForm onAdd={addTask} />
                <TaskList tasks={tasks} onComplete={handleComplete} />
              </motion.div>
            )}

            {activeTab === 'Rewards' && (
              <motion.div
                key="rewards"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <RewardsShop
                  xp={player.xp}
                  rewardsUnlocked={player.rewardsUnlocked}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <StatsTab streak={player.streak} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <aside className="app-sidebar">
          <PlayerStats
            xp={player.xp}
            level={player.level}
            streak={player.streak}
            xpToNext={player.xpToNext}
            combo={player.combo}
            dailyGoal={player.dailyGoal}
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
