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
import DevPanel from './components/DevPanel.jsx'
import { todayKey } from './domain/dateKey.js'
import { xpToLevel } from './domain/gamification.js'
import { getAchievement } from './domain/achievements.js'
import { computePowerScore } from './domain/power.js'
import { CHARACTERS } from './domain/characters.js'
import db from './db/db.js'
import { supabase } from './lib/supabase.js'
import { syncNow, getBackoffInterval, getSyncState, getAndClearMergeNote, resetAuthRequired } from './services/syncOrchestrator.js'
import { playerRepository } from './repositories/playerRepository.js'
import { hasSevereCorruption, repairDb } from './services/repairService.js'
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

const IDLE_TICK_INTERVAL_MS = 30_000

// Persist the selected date across reloads (falls back to today if stale)
function loadSelectedDate() {
  try {
    const stored = localStorage.getItem('selectedDateKey')
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored
  } catch (_) {}
  return todayKey()
}

const TAB_ANIM = {
  initial:    { opacity: 0, y: 6 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.18 },
}

/** Format an ISO timestamp as HH:MM in local timezone. */
function formatHHMM(isoString) {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  } catch (_) {
    return null
  }
}

/** Returns "hace X min" string without date-fns. */
function formatAgo(isoString) {
  if (!isoString) return null
  try {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'ahora'
    if (mins === 1) return 'hace 1 min'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    return `hace ${hrs} h`
  } catch (_) {
    return null
  }
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

  // ── Sync UX state ─────────────────────────────────────────────────────────
  // 'idle' | 'syncing' | 'error' | 'offline'
  const [syncStatus, setSyncStatus] = useState('idle')
  const [lastSyncOkAt, setLastSyncOkAt] = useState(null)
  const [syncErrorMsg, setSyncErrorMsg] = useState(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  // Merge note — shown at most once per session
  const mergeNoteShownRef = useRef(false)

  // Corruption banner dismissed state
  const [corruptionBannerDismissed, setCorruptionBannerDismissed] = useState(false)

  // Dev panel visibility
  const [showDevPanel, setShowDevPanel] = useState(false)

  // ── Sync loop refs ────────────────────────────────────────────────────────
  const syncTimeoutRef = useRef(null)
  const isSyncingRef = useRef(false)

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

  // ── Online / Offline listeners ────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      // Trigger an immediate sync when connection restored
      setSyncStatus('idle')
      triggerSync()
    }
    const onOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Core sync function ────────────────────────────────────────────────────
  const runSync = useCallback(async () => {
    if (!user || !supabase || !isOnline) return
    if (isSyncingRef.current) return

    isSyncingRef.current = true
    setSyncStatus('syncing')

    const result = await syncNow({ supabase, userId: user.id })

    isSyncingRef.current = false

    if (result.ok) {
      setSyncStatus('idle')
      setLastSyncOkAt(new Date().toISOString())
      setSyncErrorMsg(null)

      // Check for merge note (rate-limited to once per session)
      const mergeNote = getAndClearMergeNote()
      if (mergeNote && !mergeNoteShownRef.current) {
        mergeNoteShownRef.current = true
        addNotification(mergeNote)
      }
    } else {
      if (result.errorType === 'auth') {
        setSyncStatus('error')
        setSyncErrorMsg('Sesión expirada — inicia sesión de nuevo')
      } else {
        setSyncStatus('error')
        setSyncErrorMsg(result.errorMessage ?? 'Error de sincronización')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOnline])

  // ── Dynamic sync loop with backoff ────────────────────────────────────────
  const scheduleNextSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    const { consecutiveErrors } = getSyncState()
    const delay = getBackoffInterval(consecutiveErrors)
    syncTimeoutRef.current = setTimeout(async () => {
      await runSync()
      scheduleNextSync()
    }, delay)
  }, [runSync])

  // Trigger an immediate sync (cancels pending timer, runs now, reschedules)
  const triggerSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    runSync().then(() => scheduleNextSync())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSync, scheduleNextSync])

  // Start sync loop when user and supabase are available
  useEffect(() => {
    if (!user || !supabase) return
    // Initial sync + loop
    triggerSync()
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Handle DB repair (from banner or DevPanel)
  const handleRepair = useCallback(async () => {
    await repairDb()
    setCorruptionBannerDismissed(true)
    addNotification('✅ Base de datos reparada')
  }, [addNotification])

  // ── Sync HUD computation ──────────────────────────────────────────────────
  // When no supabase/user, hide entirely
  const showSyncHUD = Boolean(user && supabase)

  // Effective display state
  const displaySyncState = !isOnline
    ? 'offline'
    : syncStatus

  const syncLabel = {
    idle:    '✅ synced',
    syncing: '☁ syncing…',
    error:   '⚠️ error',
    offline: '📴 offline',
  }[displaySyncState] ?? '✅ synced'

  const syncClass = {
    idle:    'sync-state-idle',
    syncing: 'sync-state-syncing',
    error:   'sync-state-error',
    offline: 'sync-state-offline',
  }[displaySyncState] ?? 'sync-state-idle'

  const showRetryButton =
    showSyncHUD &&
    isOnline &&
    (displaySyncState === 'error' || (pendingOutboxCount ?? 0) > 0)

  // Last sync time display
  const lastSyncTimeStr = lastSyncOkAt
    ? `Último sync: ${formatHHMM(lastSyncOkAt)} (${formatAgo(lastSyncOkAt)})`
    : null

  // Corruption detection
  const showCorruptionBanner =
    !corruptionBannerDismissed &&
    hasSevereCorruption(player)

  // Auth error: show special message
  const showAuthError = displaySyncState === 'error' && syncErrorMsg?.includes('sesión')

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">TaskQuest</h1>
        <div className="app-header-right">
          <p className="app-date">Hoy · {today}</p>

          {showSyncHUD && (
            <div className="sync-hud">
              <span className={`sync-indicator ${syncClass}`} title={syncErrorMsg ?? undefined}>
                {syncLabel}
              </span>
              {lastSyncTimeStr && (
                <span className="sync-last-time">{lastSyncTimeStr}</span>
              )}
              {showRetryButton && (
                <button
                  className="sync-retry-btn"
                  onClick={triggerSync}
                  type="button"
                  title={showAuthError ? 'Reautenticar' : 'Reintentar sincronización'}
                >
                  {showAuthError ? '🔑 Login' : '↺ Reintentar'}
                </button>
              )}
            </div>
          )}

          {/* Dev panel toggle — only visible when no supabase (local dev) */}
          {!supabase && (
            <button
              className="dev-panel-toggle"
              onClick={() => setShowDevPanel((v) => !v)}
              type="button"
            >
              🛠 Dev
            </button>
          )}
        </div>
      </header>

      {/* Corruption banner — only for severe cases */}
      {showCorruptionBanner && (
        <div className="corruption-banner" role="alert">
          <span>⚠️ Se detectó un problema en los datos locales.</span>
          <button
            className="corruption-repair-btn"
            onClick={handleRepair}
            type="button"
          >
            Reparar
          </button>
          <button
            className="corruption-dismiss-btn"
            onClick={() => setCorruptionBannerDismissed(true)}
            type="button"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pill bar navigation */}
      <nav className="tabs-nav" role="tablist" aria-label="Navegación principal">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-btn ${activeTab === id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="app-layout">
        <main className="app-main">
          <AnimatePresence mode="wait">

            {activeTab === 'Base' && (
              <motion.div key="base" {...TAB_ANIM}>
                <BaseDashboard
                  player={player}
                  powerScore={powerScore}
                  onNotify={addNotification}
                  onNavigateTo={setActiveTab}
                />
              </motion.div>
            )}

            {activeTab === 'Tasks' && (
              <motion.div key="tasks" {...TAB_ANIM}>
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
              <motion.div key="rewards" {...TAB_ANIM}>
                <RewardsShop
                  xp={player.xp}
                  rewardsUnlocked={player.rewardsUnlocked}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Stats' && (
              <motion.div key="stats" {...TAB_ANIM}>
                <StatsTab streak={player.streak} />
              </motion.div>
            )}

            {activeTab === 'Colección' && (
              <motion.div key="collection" {...TAB_ANIM}>
                <CharacterCollection
                  xp={player.xp}
                  unlockedCharacters={player.unlockedCharacters}
                  activeTeam={player.activeTeam}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Boosts' && (
              <motion.div key="boosts" {...TAB_ANIM}>
                <BoostShop
                  coins={player.coins}
                  boosts={player.boosts}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Mapa' && (
              <motion.div key="mapa" {...TAB_ANIM}>
                <ZonesMap
                  player={player}
                  powerScore={powerScore}
                  onNotify={addNotification}
                />
              </motion.div>
            )}

            {activeTab === 'Talentos' && (
              <motion.div key="talentos" {...TAB_ANIM}>
                <TalentTree
                  essence={player.essence}
                  talents={player.talents}
                  onNotify={addNotification}
                />
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
            onNavigateToMap={() => setActiveTab('Mapa')}
          />
        </aside>
      </div>

      {/* Dev panel (only without supabase config) */}
      {showDevPanel && (
        <DevPanel
          onClose={() => setShowDevPanel(false)}
          onNotify={addNotification}
        />
      )}

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
