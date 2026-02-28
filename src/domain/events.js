/**
 * Events system domain logic for TaskQuest.
 *
 * Provides daily (7, one per day of week) and weekly (4, rotating mod 4)
 * events that apply small, controlled modifiers to game economy values.
 *
 * All functions are pure and deterministic — no RNG, no side effects.
 * Rotation is driven solely by the dateKey (YYYY-MM-DD local timezone).
 *
 * Modifier effects:
 *   taskCoinMultiplier  – multiplies the base coin reward per task (non-clone)
 *   idleCpmMultiplier   – multiplies the effective coins-per-minute in idle
 *   gachaRareBonus      – additive bonus to the rare drop-rate in gacha
 *   boostPriceMultiplier – multiplies boost purchase prices (< 1 = discount)
 *   energyCapBonus       – additive bonus to the effective energy cap
 *
 * Caps (to prevent runaway values when daily + weekly stack):
 *   taskCoinMultiplier  ≤ 2.0
 *   idleCpmMultiplier   ≤ 2.0
 *   gachaRareBonus      ≤ 0.15
 *   boostPriceMultiplier ≥ 0.50  (max 50 % discount)
 *   energyCapBonus       ≤ 50
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Base coins awarded per completed non-clone task. */
export const BASE_TASK_COIN_REWARD = 10

/** Coins awarded on a once-per-day event-bonus claim. */
export const EVENT_CLAIM_BONUS = 20

// ── Daily event catalog (7 events, one per day of week) ──────────────────────

/**
 * DAILY_EVENTS[i] is active when dayOfWeek(dateKey) === i.
 *   0 = Sunday, 1 = Monday, …, 6 = Saturday  (matches JS Date.getDay())
 */
export const DAILY_EVENTS = [
  // 0 – Sunday
  {
    id: 'golden_sunday',
    title: 'Domingo Dorado',
    subtitle: 'Las recompensas en monedas brillan más',
    icon: '🪙',
    tagColor: '#f59e0b',
    modifiers: { taskCoinMultiplier: 1.10 },
  },
  // 1 – Monday
  {
    id: 'monday_surge',
    title: 'Impulso del Lunes',
    subtitle: 'Empieza la semana con más energía pasiva',
    icon: '⚡',
    tagColor: '#3b82f6',
    modifiers: { idleCpmMultiplier: 1.12 },
  },
  // 2 – Tuesday
  {
    id: 'gacha_tuesday',
    title: 'Martes Gacha',
    subtitle: 'Mayor probabilidad de rarezas en invocaciones',
    icon: '🎲',
    tagColor: '#a855f7',
    modifiers: { gachaRareBonus: 0.02 },
  },
  // 3 – Wednesday
  {
    id: 'boost_wednesday',
    title: 'Miércoles de Ofertas',
    subtitle: 'Los boosts tienen un 15 % de descuento hoy',
    icon: '🚀',
    tagColor: '#06b6d4',
    modifiers: { boostPriceMultiplier: 0.85 },
  },
  // 4 – Thursday
  {
    id: 'energy_thursday',
    title: 'Jueves Energético',
    subtitle: 'Tu energía máxima aumenta +10 durante el día',
    icon: '🔋',
    tagColor: '#22c55e',
    modifiers: { energyCapBonus: 10 },
  },
  // 5 – Friday
  {
    id: 'xp_friday',
    title: 'Viernes Frenético',
    subtitle: 'Monedas de tareas y farming acelerados',
    icon: '🌟',
    tagColor: '#eab308',
    modifiers: { taskCoinMultiplier: 1.10, idleCpmMultiplier: 1.05 },
  },
  // 6 – Saturday
  {
    id: 'power_saturday',
    title: 'Sábado de Poder',
    subtitle: 'Todos los multiplicadores activos se potencian',
    icon: '💪',
    tagColor: '#f97316',
    modifiers: { taskCoinMultiplier: 1.05, idleCpmMultiplier: 1.08 },
  },
]

// ── Weekly event catalog (4 events, epochWeek mod 4) ─────────────────────────

/**
 * WEEKLY_EVENTS[epochWeek % 4] is active for the current week.
 * epochWeek = floor(localNoon.getTime() / MS_PER_WEEK)  — deterministic, never resets.
 */
export const WEEKLY_EVENTS = [
  // Week mod 0
  {
    id: 'harvest_week',
    title: 'Semana de la Cosecha',
    subtitle: 'Mayor rendimiento de monedas en tareas y farming',
    icon: '🌾',
    tagColor: '#f59e0b',
    modifiers: { taskCoinMultiplier: 1.05, idleCpmMultiplier: 1.05 },
  },
  // Week mod 1
  {
    id: 'master_week',
    title: 'Semana del Maestro',
    subtitle: 'La suerte del maestro mejora las invocaciones gacha',
    icon: '🎴',
    tagColor: '#a855f7',
    modifiers: { gachaRareBonus: 0.02 },
  },
  // Week mod 2
  {
    id: 'colossus_week',
    title: 'Semana del Coloso',
    subtitle: 'Tu energía máxima se expande +15 esta semana',
    icon: '🏰',
    tagColor: '#3b82f6',
    modifiers: { energyCapBonus: 15 },
  },
  // Week mod 3
  {
    id: 'fortune_week',
    title: 'Semana de la Fortuna',
    subtitle: 'Los boosts cuestan un 10 % menos durante toda la semana',
    icon: '🍀',
    tagColor: '#22c55e',
    modifiers: { boostPriceMultiplier: 0.90 },
  },
]

// ── Internal date helpers ─────────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1_000

/**
 * Parses a YYYY-MM-DD dateKey into a local-timezone Date at noon
 * (to avoid DST shifts affecting the day).
 *
 * @param {string} dateKey
 * @returns {Date}
 */
function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/**
 * Returns the day-of-week for a dateKey (0 = Sunday … 6 = Saturday).
 * @param {string} dateKey
 * @returns {number}
 */
function dayOfWeekFromKey(dateKey) {
  return parseDateKey(dateKey).getDay()
}

/**
 * Returns the epoch-week index (weeks since Unix epoch) for a dateKey.
 * Deterministic: never resets, increments by 1 every 7 days.
 * @param {string} dateKey
 * @returns {number}
 */
function epochWeekFromKey(dateKey) {
  const date = parseDateKey(dateKey)
  return Math.floor(date.getTime() / MS_PER_WEEK)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the active daily event for a given dateKey.
 * Determined by day of week; always returns a valid event.
 *
 * @param {string} dateKey – YYYY-MM-DD local date
 * @returns {object} event from DAILY_EVENTS
 */
export function getDailyEvent(dateKey) {
  const dow = dayOfWeekFromKey(dateKey)
  return DAILY_EVENTS[dow]
}

/**
 * Returns the active weekly event for a given dateKey.
 * Rotates through WEEKLY_EVENTS every 7 days using epoch-week mod 4.
 *
 * @param {string} dateKey – YYYY-MM-DD local date
 * @returns {object} event from WEEKLY_EVENTS
 */
export function getWeeklyEvent(dateKey) {
  const weekIdx = epochWeekFromKey(dateKey) % 4
  return WEEKLY_EVENTS[weekIdx]
}

/**
 * Returns both active events for a given dateKey.
 *
 * @param {string} dateKey – YYYY-MM-DD local date
 * @returns {{ daily: object, weekly: object }}
 */
export function getActiveEvents(dateKey) {
  return {
    daily: getDailyEvent(dateKey),
    weekly: getWeeklyEvent(dateKey),
  }
}

/**
 * Accumulates and clamps event modifiers from both active events.
 *
 * Modifier stacking rules:
 *  - taskCoinMultiplier, idleCpmMultiplier → multiplicative, clamped ≤ 2.0
 *  - gachaRareBonus, energyCapBonus        → additive
 *  - boostPriceMultiplier                  → min() (best discount wins), clamped ≥ 0.50
 *
 * @param {object} base         – baseline values (currently unused; reserved for future config)
 * @param {{ daily?: object, weekly?: object }} activeEvents
 * @returns {{
 *   taskCoinMultiplier:  number,
 *   idleCpmMultiplier:   number,
 *   gachaRareBonus:      number,
 *   boostPriceMultiplier: number,
 *   energyCapBonus:      number,
 * }}
 */
export function applyEventModifiers(base = {}, activeEvents = {}) {
  const events = [activeEvents.daily, activeEvents.weekly].filter(Boolean)

  let taskCoinMultiplier  = 1.0
  let idleCpmMultiplier   = 1.0
  let gachaRareBonus      = 0.0
  let boostPriceMultiplier = 1.0
  let energyCapBonus      = 0

  for (const event of events) {
    const m = event.modifiers ?? {}
    if (m.taskCoinMultiplier   != null) taskCoinMultiplier   *= m.taskCoinMultiplier
    if (m.idleCpmMultiplier    != null) idleCpmMultiplier    *= m.idleCpmMultiplier
    if (m.gachaRareBonus       != null) gachaRareBonus       += m.gachaRareBonus
    if (m.boostPriceMultiplier != null) boostPriceMultiplier  = Math.min(boostPriceMultiplier, m.boostPriceMultiplier)
    if (m.energyCapBonus       != null) energyCapBonus       += m.energyCapBonus
  }

  // Clamp to safe ranges
  taskCoinMultiplier   = Math.min(taskCoinMultiplier, 2.0)
  idleCpmMultiplier    = Math.min(idleCpmMultiplier, 2.0)
  gachaRareBonus       = Math.min(gachaRareBonus, 0.15)
  boostPriceMultiplier = Math.max(boostPriceMultiplier, 0.50)
  energyCapBonus       = Math.min(energyCapBonus, 50)

  return {
    taskCoinMultiplier,
    idleCpmMultiplier,
    gachaRareBonus,
    boostPriceMultiplier,
    energyCapBonus,
  }
}

/**
 * Convenience wrapper: returns economy modifiers for a given dateKey.
 * Merges any base config with event-derived modifiers.
 *
 * @param {object} config   – base economy config (may be empty)
 * @param {string} dateKey  – YYYY-MM-DD local date
 * @returns {object} merged config with event modifiers applied
 */
export function getEconomyWithEvents(config = {}, dateKey) {
  const activeEvents = getActiveEvents(dateKey)
  const mods = applyEventModifiers({}, activeEvents)
  return { ...config, ...mods }
}

/**
 * Returns true if the player can claim the daily event bonus.
 * Anti-duplication: claim is locked once per dateKey.
 *
 * @param {{ lastEventClaimDate?: string|null }} player
 * @param {string} dateKey
 * @returns {boolean}
 */
export function canClaimEventBonus(player, dateKey) {
  return (player.lastEventClaimDate ?? null) !== dateKey
}

/**
 * Computes a human-readable list of effect descriptions for an event's modifiers.
 * Used by the UI to render bullet-point summaries.
 *
 * @param {{ modifiers: object }} event
 * @returns {string[]}
 */
export function getEventEffectLines(event) {
  if (!event || !event.modifiers) return []
  const m = event.modifiers
  const lines = []
  if (m.taskCoinMultiplier  != null) lines.push(`+${Math.round((m.taskCoinMultiplier - 1) * 100)}% monedas por tarea`)
  if (m.idleCpmMultiplier   != null) lines.push(`+${Math.round((m.idleCpmMultiplier - 1) * 100)}% monedas/min (idle)`)
  if (m.gachaRareBonus      != null) lines.push(`+${Math.round(m.gachaRareBonus * 100)}% tasa rare gacha`)
  if (m.boostPriceMultiplier != null) lines.push(`-${Math.round((1 - m.boostPriceMultiplier) * 100)}% precio boosts`)
  if (m.energyCapBonus      != null) lines.push(`+${m.energyCapBonus} energía máxima`)
  return lines
}
