import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTasks } from './hooks/useTasks.js'
import { usePlayer } from './hooks/usePlayer.js'
import { useAuth } from './hooks/useAuth.js'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'
import PlayerStats from './components/PlayerStats.jsx'
import LevelUpOverlay from './components/LevelUpOverlay.jsx'
import Notifications from './components/Notifications.jsx'
import RewardsShop from './components/RewardsShop.jsx'
import StatsTab from './components/StatsTab.jsx'
import MiniCalendar from './components/MiniCalendar.jsx'
import CharacterCollection from './components/CharacterCollection.jsx'
import BoostShop from './components/BoostShop.jsx'
import FarmHUD from './components/FarmHUD.jsx'
import TeamPanel from './components/TeamPanel.jsx'
import { todayKey } from './domain/dateKey.js'
import { xpToLevel } from './domain/gamification.js'
import { getAchievement } from './domain/achievements.js'
import db from './db/db.js'
import { supabase } from './lib/supabase.js'
import { pushOutbox, pullRemote } from './services/taskSyncService.js'
import { pushPlayerOutbox, pullPlayerRemote } from './services/playerSyncService.js'
import { playerRepository } from './repositories/playerRepository.js'
import './App.css'

let notifIdCounter = 0

// Base | Tasks | Boosts | Tienda | Stats | Colección
const TABS = ['Base', 'Tasks', 'Boosts', 'Tienda', 'Stats', 'Colección']

const TAB_ICONS = {
  Base:      '🏠',
  Tasks:     '✅',
  Boosts:    '🚀',
  Tienda:    '🏪',
  Stats:     '📊',
  Colección: '👥',
}

const SYNC_INTERVAL_MS = 15_000
const IDLE_TICK_INTERVAL_MS = 30_000

// Persist the selected date across reloads (falls back to today if stale)
function loadSelectedDate() {
  try {
    const stored = localStorage.getItem('selectedDateKey')
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
  } catch (_) {}
  return todayKey()
}

function App() {
  const today = todayKey()

  const [selectedDateKey, setSelectedDateKey] = useState(loadSelectedDate)
  const [calendarOpen, setCalendarOpen] = useState(true)

  const { tasks, addTask, completeTask } = useTasks(selectedDateKey)
  const player = usePlayer()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('Base')
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Live count of pending outbox entries (drives the sync indicator)
  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.where('status').equals('pending').count(),
    [],
    0
  )

  // Keep a ref of current XP so handleComplete can read it synchronously
  const playerXpRef = useRef(player.xp)
  useEffect(() => {
    playerXpRef.current = player.xp
  }, [player.xp])

  // Sync loop: run immediately on login, then every SYNC_INTERVAL_MS
  useEffect(() => {
    if (!user || !supabase) return

    const sync = () => {
      pushOutbox({ supabase, userId: user.id }).catch(console.warn)
      pullRemote({ supabase, userId: user.id }).catch(console.warn)
      pushPlayerOutbox({ supabase, userId: user.id }).catch(console.warn)
      pullPlayerRemote({ supabase, userId: user.id }).catch(console.warn)
    }

    sync()
    const intervalId = setInterval(sync, SYNC_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [user])

  // Idle tick loop: every 30 s, process idle earnings (works offline too)
  useEffect(() => {
    const tick = () => {
      playerRepository.tickIdle(Date.now()).catch(console.warn)
    }
    const intervalId = setInterval(tick, IDLE_TICK_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [])

  const handleSelectDateKey = useCallback((dateKey) => {
    setSelectedDateKey(dateKey)
    try {
      localStorage.setItem('selectedDateKey', dateKey)
    } catch (_) {}
  }, [])

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

  const isSyncing = user && supabase && (pendingOutboxCount ?? 0) > 0

  // Base tab: full-width (no sidebar). Tasks tab: main + sidebar.
  const hasSidebar = activeTab === 'Tasks'

  return (
    <div className="app">
      {/* ── Compact header ── */}
      <header className="app-header">
        <h1 className="app-title">TaskQuest</h1>
        <div className="app-header-right">
          <span className="app-date">{today}</span>
          {isSyncing && (
            <span className="sync-indicator" title="Sincronizando con la nube…">
              ☁ syncing…
            </span>
          )}
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <nav className="tabs-nav" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab-btn ${activeTab === tab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="tab-icon" aria-hidden="true">{TAB_ICONS[tab]}</span>
            <span className="tab-label">{tab}</span>
          </button>
        ))}
      </nav>

      {/* ── Layout: full-width or main+sidebar ── */}
      <div className={`app-layout${hasSidebar ? ' has-sidebar' : ''}`}>
        <main className="app-main">
          <AnimatePresence mode="wait">

            {/* ── Base (idle farming home) ── */}
            {activeTab === 'Base' && (
              <motion.div
                key="base"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="base-tab"
              >
                <FarmHUD
                  coins={player.coins}
                  energy={player.energy}
                  energyCap={player.energyCap}
                  boosts={player.boosts}
                  coinsPerMinuteBase={player.coinsPerMinuteBase}
                  onNotify={addNotification}
                />

                <div className="base-bottom-grid">
                  <TeamPanel
                    activeTeam={player.activeTeam}
                    onNavigate={setActiveTab}
                  />

                  {/* Quick actions */}
                  <div className="quick-actions">
                    <h3 className="quick-actions-title">Acción rápida</h3>
                    <TaskForm onAdd={addTask} />
                    <div className="quick-links">
                      <button
                        className="quick-link-btn"
                        onClick={() => setActiveTab('Boosts')}
                        type="button"
                      >
                        🚀 Boosts
                      </button>
                      <button
                        className="quick-link-btn"
                        onClick={() => setActiveTab('Tienda')}
                        type="button"
                      >
                        🏪 Tienda
                      </button>
                      <button
                        className="quick-link-btn"
                        onClick={() => setActiveTab('Colección')}
                        type="button"
                      >
                        👥 Colección
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Tasks ── */}
            {activeTab === 'Tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {/* Calendar toggle — always visible */}
                <button
                  className="mc-toggle-btn"
                  onClick={() => setCalendarOpen((o) => !o)}
                  type="button"
                >
                  📅 Calendario {calendarOpen ? '▲' : '▼'}
                </button>

                <div className={`mc-wrapper${calendarOpen ? ' mc-open' : ''}`}>
                  <MiniCalendar
                    selectedDateKey={selectedDateKey}
                    todayKey={today}
                    onSelectDateKey={handleSelectDateKey}
                  />
                </div>

                <TaskForm onAdd={addTask} />
                <TaskList tasks={tasks} onComplete={handleComplete} />
              </motion.div>
            )}

            {/* ── Boosts ── */}
            {activeTab === 'Boosts' && (
              <motion.div
                key="boosts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <BoostShop
                  coins={player.coins}
                  boosts={player.boosts}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {/* ── Tienda (Rewards shop) ── */}
            {activeTab === 'Tienda' && (
              <motion.div
                key="tienda"
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

            {/* ── Stats ── */}
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

            {/* ── Colección ── */}
            {activeTab === 'Colección' && (
              <motion.div
                key="collection"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <CharacterCollection
                  xp={player.xp}
                  unlockedCharacters={player.unlockedCharacters}
                  activeTeam={player.activeTeam}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Sidebar: only shown on Tasks tab */}
        {hasSidebar && (
          <aside className="app-sidebar">
            <PlayerStats
              xp={player.xp}
              level={player.level}
              streak={player.streak}
              xpToNext={player.xpToNext}
              combo={player.combo}
              dailyGoal={player.dailyGoal}
              syncStatus={player.syncStatus}
              activeTeam={player.activeTeam}
              coins={player.coins}
              energy={player.energy}
              energyCap={player.energyCap}
              boosts={player.boosts}
              coinsPerMinuteBase={player.coinsPerMinuteBase}
              onNotify={addNotification}
            />
          </aside>
        )}
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
