import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTasks } from './hooks/useTasks.js'
import { usePlayer } from './hooks/usePlayer.js'
import { useAuth } from './hooks/useAuth.js'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'
import PlayerStats from './components/PlayerStats.jsx'
import BaseDashboard from './components/BaseDashboard.jsx'
import LevelUpOverlay from './components/LevelUpOverlay.jsx'
import Notifications from './components/Notifications.jsx'
import RewardsShop from './components/RewardsShop.jsx'
import StatsTab from './components/StatsTab.jsx'
import MiniCalendar from './components/MiniCalendar.jsx'
import CharacterCollection from './components/CharacterCollection.jsx'
import BoostShop from './components/BoostShop.jsx'
import ZonesMap from './components/ZonesMap.jsx'
import TalentTree from './components/TalentTree.jsx'
import { todayKey } from './domain/dateKey.js'
import { xpToLevel } from './domain/gamification.js'
import { getAchievement } from './domain/achievements.js'
import { computePowerScore } from './domain/power.js'
import { CHARACTERS } from './domain/characters.js'
import db from './db/db.js'
import { supabase } from './lib/supabase.js'
import { pushOutbox, pullRemote } from './services/taskSyncService.js'
import { pushPlayerOutbox, pullPlayerRemote } from './services/playerSyncService.js'
import { playerRepository } from './repositories/playerRepository.js'
import './App.css'

let notifIdCounter = 0

// Tab definitions with icons
const TABS = [
  { id: 'Base',      label: '🏠 Base' },
  { id: 'Tasks',     label: '✓ Tasks' },
  { id: 'Rewards',   label: '🎁 Rewards' },
  { id: 'Stats',     label: '📊 Stats' },
  { id: 'Colección', label: '👥 Colección' },
  { id: 'Boosts',    label: '🚀 Boosts' },
  { id: 'Mapa',      label: '🗺️ Mapa' },
  { id: 'Talentos',  label: '🌟 Talentos' },
]

const TAB_IDS = TABS.map((t) => t.id)

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
  const [prevTab, setPrevTab] = useState('Base')
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [hudCollapsed, setHudCollapsed] = useState(false)

  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.where('status').equals('pending').count(),
    [],
    0
  )

  const powerScore = useMemo(
    () => computePowerScore(player.activeTeam ?? [], {}, CHARACTERS),
    [player.activeTeam]
  )

  const playerXpRef = useRef(player.xp)
  useEffect(() => { playerXpRef.current = player.xp }, [player.xp])

  // Sync loop
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

  // Idle tick loop (background)
  useEffect(() => {
    const tick = () => { playerRepository.tickIdle(Date.now()).catch(console.warn) }
    const intervalId = setInterval(tick, IDLE_TICK_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [])

  const handleSelectDateKey = useCallback((dateKey) => {
    setSelectedDateKey(dateKey)
    try { localStorage.setItem('selectedDateKey', dateKey) } catch (_) {}
  }, [])

  const addNotification = useCallback((message) => {
    const id = ++notifIdCounter
    setNotifications((prev) => [...prev, { id, message }])
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handleComplete = useCallback(async (taskId) => {
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
      if (achievement) addNotification(`🏆 Logro desbloqueado: ${achievement.title}`)
    }

    return xpEarned
  }, [completeTask, addNotification])

  // Directional tab navigation
  const handleTabChange = useCallback((tabId) => {
    setPrevTab(activeTab)
    setActiveTab(tabId)
  }, [activeTab])

  const tabDirection = TAB_IDS.indexOf(activeTab) > TAB_IDS.indexOf(prevTab) ? 1 : -1

  const tabVariants = {
    initial: (dir) => ({ opacity: 0, x: dir * 10 }),
    animate: { opacity: 1, x: 0 },
    exit:    (dir) => ({ opacity: 0, x: dir * -10 }),
  }

  const isSyncing = user && supabase && (pendingOutboxCount ?? 0) > 0

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">TaskQuest</h1>
        <div className="app-header-right">
          <p className="app-date">Hoy · {today}</p>
          {isSyncing && (
            <span className="sync-indicator" title="Sincronizando con la nube…">
              ☁ syncing…
            </span>
          )}
        </div>
      </header>

      {/* Pill bar navigation — sticky on mobile */}
      <nav className="tabs-nav" role="tablist" aria-label="Navegación principal">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-btn ${activeTab === id ? 'tab-active' : ''}`}
            onClick={() => handleTabChange(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="app-layout">
        <main className="app-main">
          <AnimatePresence mode="wait" custom={tabDirection}>

            {activeTab === 'Base' && (
              <motion.div
                key="base"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <BaseDashboard
                  player={player}
                  powerScore={powerScore}
                  onNotify={addNotification}
                  onNavigateTo={handleTabChange}
                />
              </motion.div>
            )}

            {activeTab === 'Tasks' && (
              <motion.div
                key="tasks"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
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

            {activeTab === 'Rewards' && (
              <motion.div
                key="rewards"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
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
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <StatsTab streak={player.streak} />
              </motion.div>
            )}

            {activeTab === 'Colección' && (
              <motion.div
                key="collection"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <CharacterCollection
                  xp={player.xp}
                  unlockedCharacters={player.unlockedCharacters}
                  activeTeam={player.activeTeam}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Boosts' && (
              <motion.div
                key="boosts"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <BoostShop
                  coins={player.coins}
                  boosts={player.boosts}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Mapa' && (
              <motion.div
                key="mapa"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <ZonesMap
                  player={player}
                  powerScore={powerScore}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Talentos' && (
              <motion.div
                key="talentos"
                custom={tabDirection}
                variants={tabVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <TalentTree
                  essence={player.essence}
                  talents={player.talents}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        <aside className={`app-sidebar${hudCollapsed ? ' app-sidebar-collapsed' : ''}`}>
          {/* Collapsible HUD toggle (mobile only) */}
          <button
            className="sidebar-hud-toggle"
            type="button"
            onClick={() => setHudCollapsed((c) => !c)}
            aria-expanded={!hudCollapsed}
            aria-controls="player-hud"
          >
            <span>📊 HUD del jugador</span>
            <span aria-hidden="true">{hudCollapsed ? '▼' : '▲'}</span>
          </button>

          <div id="player-hud">
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
              currentZone={player.currentZone}
              powerScore={powerScore}
              onNotify={addNotification}
              onNavigateToMap={() => handleTabChange('Mapa')}
            />
          </div>
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
