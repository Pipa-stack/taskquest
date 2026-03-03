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
import CommandPalette from './components/CommandPalette.jsx'
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx'
import MobileStatsBar from './components/MobileStatsBar.jsx'
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
import {
  LayoutDashboard,
  CheckSquare,
  Gift,
  BarChart3,
  Users,
  Zap,
  Map,
  Sparkles,
  Loader2,
} from 'lucide-react'
import './App.css'

let notifIdCounter = 0

// Sidebar navigation items — Icon is a Lucide component (stroke, 18px)
const NAV_ITEMS = [
  { id: 'Base',      Icon: LayoutDashboard, label: 'Base' },
  { id: 'Tasks',     Icon: CheckSquare,     label: 'Tareas' },
  { id: 'Rewards',   Icon: Gift,            label: 'Recompensas' },
  { id: 'Stats',     Icon: BarChart3,       label: 'Estadísticas' },
  { id: 'Colección', Icon: Users,           label: 'Colección' },
  { id: 'Boosts',    Icon: Zap,             label: 'Boosts' },
  { id: 'Mapa',      Icon: Map,             label: 'Mapa' },
  { id: 'Talentos',  Icon: Sparkles,        label: 'Talentos' },
]

/** Formats a YYYY-MM-DD dateKey as a natural Spanish date string.
 *  Uses local-date construction to avoid UTC timezone offsets. */
function formatDateES(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  // Capitalize the first letter (es-ES weekday names are lowercase)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const SYNC_INTERVAL_MS   = 15_000
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
  transition: { duration: 0.15 },
}

function App() {
  const today = todayKey()

  const [selectedDateKey, setSelectedDateKey] = useState(loadSelectedDate)
  const [calendarOpen, setCalendarOpen]       = useState(true)

  const { tasks, addTask, completeTask } = useTasks(selectedDateKey)
  const player = usePlayer()
  const { user } = useAuth()

  const [activeTab, setActiveTab]   = useState('Base')
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [paletteOpen,   setPaletteOpen]   = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

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

  // ── Command Palette actions ──────────────────────────────────────────
  const paletteActions = useMemo(() => [
    ...NAV_ITEMS.map((item, i) => ({
      id:       `nav-${item.id}`,
      label:    `Ir a ${item.label}`,
      shortcut: `Alt+${i + 1}`,
      onSelect: () => setActiveTab(item.id),
    })),
    {
      id:       'new-task',
      label:    'Nueva tarea',
      shortcut: 'N',
      onSelect: () => setActiveTab('Tasks'),
    },
    {
      id:       'claim-idle',
      label:    'Reclamar monedas idle',
      shortcut: 'Ctrl+I',
      onSelect: () => playerRepository.tickIdle(Date.now()).catch(console.warn),
    },
    {
      id:       'sync-now',
      label:    'Sincronizar ahora',
      shortcut: 'Ctrl+S',
      onSelect: () => {
        if (!user || !supabase) return
        pushOutbox({ supabase, userId: user.id }).catch(console.warn)
        pullRemote({ supabase, userId: user.id }).catch(console.warn)
        pushPlayerOutbox({ supabase, userId: user.id }).catch(console.warn)
        pullPlayerRemote({ supabase, userId: user.id }).catch(console.warn)
      },
    },
  ], [user]) // setActiveTab is a stable state setter; user is the only external dep

  // ── Global keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      // Ctrl+K always toggles the palette (even while typing in a form field)
      if (e.ctrlKey && !e.metaKey && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }

      // Guard: skip all other shortcuts when typing in a form field
      const active    = document.activeElement
      const isTyping  = (
        active?.tagName === 'INPUT'    ||
        active?.tagName === 'TEXTAREA' ||
        active?.isContentEditable
      )
      if (isTyping) return

      // Alt+1…8 — navigate to each tab
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const n = parseInt(e.key, 10)
        if (n >= 1 && n <= NAV_ITEMS.length) {
          e.preventDefault()
          setActiveTab(NAV_ITEMS[n - 1].id)
          return
        }
      }

      // Ctrl+I — claim idle coins
      if (e.ctrlKey && !e.metaKey && e.key === 'i') {
        e.preventDefault()
        playerRepository.tickIdle(Date.now()).catch(console.warn)
        return
      }

      // Ctrl+S — manual sync
      if (e.ctrlKey && !e.metaKey && e.key === 's') {
        e.preventDefault()
        if (user && supabase) {
          pushOutbox({ supabase, userId: user.id }).catch(console.warn)
          pullRemote({ supabase, userId: user.id }).catch(console.warn)
          pushPlayerOutbox({ supabase, userId: user.id }).catch(console.warn)
          pullPlayerRemote({ supabase, userId: user.id }).catch(console.warn)
        }
        return
      }

      // ? — toggle shortcuts overlay
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user]) // paletteOpen/shortcutsOpen not needed: setters are stable

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
    const prevXp    = playerXpRef.current
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

  const isSyncing = user && supabase && (pendingOutboxCount ?? 0) > 0

  // Derive the page label shown in the top bar
  const pageLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? activeTab

  return (
    <div className="app-shell">

      {/* ─── Left Sidebar ──────────────────────────────────────────── */}
      <aside className="sidebar" aria-label="Navegación principal">

        {/* Brand */}
        <div className="sidebar-brand" aria-label="TaskQuest">
          <span className="sidebar-logo" aria-hidden="true">TQ</span>
          <span className="sidebar-title">TaskQuest</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" role="navigation">
          {NAV_ITEMS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-nav-item${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <Icon className="sidebar-nav-icon" size={18} aria-hidden="true" />
              <span className="sidebar-nav-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* Player HUD */}
        <div className="sidebar-hud">
          <PlayerStats
            xp={player.xp}
            level={player.level}
            streak={player.streak}
            xpToNext={player.xpToNext}
            combo={player.combo}
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
        </div>

      </aside>

      {/* ─── Main body ─────────────────────────────────────────────── */}
      <div className="app-body">

        {/* Top bar */}
        <header className="top-bar">
          <span className="top-bar-page">{pageLabel}</span>
          <div className="top-bar-meta">
            <span className="top-bar-date">{formatDateES(today)}</span>
            {isSyncing && (
              <span
                className="sync-indicator"
                title="Sincronizando cambios…"
                aria-label="Sincronizando cambios con el servidor"
              >
                <Loader2 className="spin" size={12} aria-hidden="true" />
                Sincronizando…
              </span>
            )}
          </div>
        </header>

        {/* Mobile compact stats bar — visible only on ≤768px */}
        <MobileStatsBar
          level={player.level}
          xpToNext={player.xpToNext}
          coins={player.coins}
          energy={player.energy}
          energyCap={player.energyCap}
          isSyncing={isSyncing}
        />

        {/* Page content */}
        <main className="main-content">
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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

    </div>
  )
}

export default App
