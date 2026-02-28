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
 *   taskCoinMultiplier      – multiplies the base coin reward per task (non-clone)
 *   idleCpmMultiplier       – multiplies the effective coins-per-minute in idle
 *   gachaRareBonus          – additive bonus to the rare drop-rate in gacha
 *   gachaFirstPackDiscount  – fractional discount on the first gacha pack per day (e.g. 0.20 = 20 %)
 *   boostPriceMultiplier    – multiplies boost purchase prices (< 1 = discount)
 *   energyCapBonus          – additive bonus to the effective energy cap
 *   freeIdleClaimOncePerDay – boolean: first manual idle claim of the day skips energy consumption
 *
 * Caps (to prevent runaway values when daily + weekly stack):
 *   taskCoinMultiplier      ≤ 2.0
 *   idleCpmMultiplier       ≤ 2.0
 *   gachaRareBonus          ≤ 0.15
 *   gachaFirstPackDiscount  ≤ 0.50  (max 50 % off)
 *   boostPriceMultiplier    ≥ 0.50  (max 50 % discount)
 *   energyCapBonus          ≤ 50
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Base coins awarded per completed non-clone task. */
export const BASE_TASK_COIN_REWARD = 10

/** Base coins awarded on the default once-per-day event-bonus claim. */
export const EVENT_CLAIM_BONUS = 20

/** Dust awarded when the daily event is gacha-themed. */
export const EVENT_GACHA_DUST_BONUS = 25

/** Energy awarded when the daily event is energy-themed. */
export const EVENT_ENERGY_BONUS = 20

/** Milliseconds added to an active boost when the boost daily event is claimed. */
export const EVENT_BOOST_EXTEND_MS = 10 * 60 * 1_000  // 10 minutes

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
  // 2 – Tuesday  ← accionable: primer pack −20 % + rare bonus
  {
    id: 'gacha_tuesday',
    title: 'Martes Gacha',
    subtitle: 'Mejor probabilidad de rarezas + primer pack del día con descuento',
    icon: '🎲',
    tagColor: '#a855f7',
    modifiers: {
      gachaRareBonus: 0.02,
      gachaFirstPackDiscount: 0.20,  // 20 % off, limitOncePerDay
    },
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
  // 4 – Thursday  ← accionable: reclamo idle gratis 1 vez/día
  {
    id: 'energy_thursday',
    title: 'Jueves Energético',
    subtitle: '+10 energía máx y 1 reclamo idle sin gastar energía (1 vez/día)',
    icon: '🔋',
    tagColor: '#22c55e',
    modifiers: {
      energyCapBonus: 10,
      freeIdleClaimOncePerDay: true,
    },
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
 */
function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** Returns the day-of-week for a dateKey (0 = Sunday … 6 = Saturday). */
function dayOfWeekFromKey(dateKey) {
  return parseDateKey(dateKey).getDay()
}

/**
 * Returns the epoch-week index (weeks since Unix epoch) for a dateKey.
 * Deterministic: never resets, increments by 1 every 7 days.
 */
function epochWeekFromKey(dateKey) {
  const date = parseDateKey(dateKey)
  return Math.floor(date.getTime() / MS_PER_WEEK)
}

// ── Public API — catalog accessors ───────────────────────────────────────────

/**
 * Returns the active daily event for a given dateKey.
 * Determined by day of week; always returns a valid event.
 */
export function getDailyEvent(dateKey) {
  const dow = dayOfWeekFromKey(dateKey)
  return DAILY_EVENTS[dow]
}

/**
 * Returns the active weekly event for a given dateKey.
 * Rotates through WEEKLY_EVENTS every 7 days using epoch-week mod 4.
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

// ── Public API — modifier accumulation ───────────────────────────────────────

/**
 * Accumulates and clamps event modifiers from both active events.
 *
 * Modifier stacking rules:
 *  - taskCoinMultiplier, idleCpmMultiplier    → multiplicative, clamped ≤ 2.0
 *  - gachaRareBonus, energyCapBonus           → additive
 *  - gachaFirstPackDiscount                   → max() (best discount wins), clamped ≤ 0.50
 *  - boostPriceMultiplier                     → min() (best discount wins), clamped ≥ 0.50
 *  - freeIdleClaimOncePerDay                  → boolean OR (any active → true)
 *
 * @param {object} base         – baseline values (reserved for future config)
 * @param {{ daily?: object, weekly?: object }} activeEvents
 * @returns {{
 *   taskCoinMultiplier:     number,
 *   idleCpmMultiplier:      number,
 *   gachaRareBonus:         number,
 *   gachaFirstPackDiscount: number,
 *   boostPriceMultiplier:   number,
 *   energyCapBonus:         number,
 *   freeIdleClaimOncePerDay: boolean,
 * }}
 */
export function applyEventModifiers(base = {}, activeEvents = {}) {
  const events = [activeEvents.daily, activeEvents.weekly].filter(Boolean)

  let taskCoinMultiplier      = 1.0
  let idleCpmMultiplier       = 1.0
  let gachaRareBonus          = 0.0
  let gachaFirstPackDiscount  = 0.0
  let boostPriceMultiplier    = 1.0
  let energyCapBonus          = 0
  let freeIdleClaimOncePerDay = false

  for (const event of events) {
    const m = event.modifiers ?? {}
    if (m.taskCoinMultiplier      != null) taskCoinMultiplier     *= m.taskCoinMultiplier
    if (m.idleCpmMultiplier       != null) idleCpmMultiplier      *= m.idleCpmMultiplier
    if (m.gachaRareBonus          != null) gachaRareBonus         += m.gachaRareBonus
    if (m.gachaFirstPackDiscount  != null) gachaFirstPackDiscount  = Math.max(gachaFirstPackDiscount, m.gachaFirstPackDiscount)
    if (m.boostPriceMultiplier    != null) boostPriceMultiplier    = Math.min(boostPriceMultiplier, m.boostPriceMultiplier)
    if (m.energyCapBonus          != null) energyCapBonus         += m.energyCapBonus
    if (m.freeIdleClaimOncePerDay)         freeIdleClaimOncePerDay = true
  }

  // Clamp to safe ranges
  taskCoinMultiplier     = Math.min(taskCoinMultiplier, 2.0)
  idleCpmMultiplier      = Math.min(idleCpmMultiplier, 2.0)
  gachaRareBonus         = Math.min(gachaRareBonus, 0.15)
  gachaFirstPackDiscount = Math.min(gachaFirstPackDiscount, 0.50)
  boostPriceMultiplier   = Math.max(boostPriceMultiplier, 0.50)
  energyCapBonus         = Math.min(energyCapBonus, 50)

  return {
    taskCoinMultiplier,
    idleCpmMultiplier,
    gachaRareBonus,
    gachaFirstPackDiscount,
    boostPriceMultiplier,
    energyCapBonus,
    freeIdleClaimOncePerDay,
  }
}

/**
 * Convenience wrapper: returns economy modifiers for a given dateKey.
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

// ── Public API — per-player eligibility guards ────────────────────────────────

/**
 * Returns true if the player can claim the daily event bonus today.
 * Anti-duplication: claim is locked once per dateKey.
 */
export function canClaimEventBonus(player, dateKey) {
  return (player.lastEventClaimDate ?? null) !== dateKey
}

/**
 * Returns true if the gacha first-pack discount can be applied today.
 * Requires:
 *   - The daily event has gachaFirstPackDiscount > 0
 *   - player.lastGachaDiscountDate !== dateKey
 */
export function canUseGachaDiscount(player, dateKey) {
  const daily = getDailyEvent(dateKey)
  if (!(daily.modifiers?.gachaFirstPackDiscount > 0)) return false
  return (player.lastGachaDiscountDate ?? null) !== dateKey
}

/**
 * Returns true if the free idle claim benefit can be used today.
 * Requires:
 *   - The daily event has freeIdleClaimOncePerDay === true
 *   - player.lastFreeIdleClaimDate !== dateKey
 */
export function canUseFreeIdleClaim(player, dateKey) {
  const daily = getDailyEvent(dateKey)
  if (!daily.modifiers?.freeIdleClaimOncePerDay) return false
  return (player.lastFreeIdleClaimDate ?? null) !== dateKey
}

// ── Public API — themed daily claim reward ────────────────────────────────────

/**
 * Computes the once-per-day event claim reward based on the active daily event type.
 *
 * Reward mapping:
 *   gacha_*   → +25 dust (gacha dupe resource)
 *   boost_*   → +10 min on active coin boost (or +25 coins fallback if no active boost)
 *   energy_*  → +20 energy (clamped to effective cap)
 *   default   → coins × taskCoinMultiplier (clamped ≥ 1)
 *
 * @param {{ daily: object, weekly: object }} activeEvents
 * @param {{ boosts?: object[], energy?: number, energyCap?: number }} player
 * @param {number} [nowMs=Date.now()] – current timestamp (for boost expiry check)
 * @returns {{
 *   coinsDelta:    number,
 *   dustDelta:     number,
 *   energyDelta:   number,
 *   boostExtendMs: number,
 *   message:       string,
 * }}
 */
export function computeDailyClaimReward(activeEvents, player, nowMs = Date.now()) {
  const daily = activeEvents?.daily
  const id    = daily?.id ?? ''
  const mods  = applyEventModifiers({}, activeEvents ?? {})

  // gacha day → dust
  if (id.includes('gacha')) {
    return {
      coinsDelta: 0,
      dustDelta: EVENT_GACHA_DUST_BONUS,
      energyDelta: 0,
      boostExtendMs: 0,
      message: `+${EVENT_GACHA_DUST_BONUS} 💨 Polvo`,
    }
  }

  // boost day → extend active coin boost, or coins fallback
  if (id.includes('boost')) {
    const hasActiveCoinBoost = (player?.boosts ?? []).some(
      (b) => b.coinMultiplier && b.expiresAt > nowMs,
    )
    if (hasActiveCoinBoost) {
      return {
        coinsDelta: 0,
        dustDelta: 0,
        energyDelta: 0,
        boostExtendMs: EVENT_BOOST_EXTEND_MS,
        message: '+10 min ⏱️ Boost',
      }
    }
    // Fallback: coins
    return {
      coinsDelta: 25,
      dustDelta: 0,
      energyDelta: 0,
      boostExtendMs: 0,
      message: '+25 🪙 Monedas',
    }
  }

  // energy day → instant energy (clamped to effective cap)
  if (id.includes('energy')) {
    const effectiveCap = (player?.energyCap ?? 100) + mods.energyCapBonus
    const current = player?.energy ?? 0
    const energyDelta = Math.max(0, Math.min(EVENT_ENERGY_BONUS, effectiveCap - current))
    return {
      coinsDelta: 0,
      dustDelta: 0,
      energyDelta,
      boostExtendMs: 0,
      message: `+${energyDelta} 🔋 Energía`,
    }
  }

  // Default: coins with event multiplier
  const coinsDelta = Math.max(1, Math.floor(EVENT_CLAIM_BONUS * mods.taskCoinMultiplier))
  return {
    coinsDelta,
    dustDelta: 0,
    energyDelta: 0,
    boostExtendMs: 0,
    message: `+${coinsDelta} 🪙 Monedas`,
  }
}

// ── Public API — UI helpers ───────────────────────────────────────────────────

/**
 * Returns a one-line actionable recommendation based on today's daily event.
 * Used in BaseDashboard to guide player actions.
 */
export function getDailyRecommendation(dailyEvent) {
  const id = dailyEvent?.id ?? ''
  if (id.includes('gacha'))  return '🎲 Abre 1 pack hoy (mejor probabilidad de rarezas)'
  if (id.includes('boost'))  return '🚀 Compra un boost (hoy cuestan menos)'
  if (id.includes('energy')) return '🔋 Reclama idle — 1 vez gratis hoy sin gastar energía'
  if (id === 'monday_surge') return '⏳ Farming activo — vuelve en 30 min a reclamar'
  return '✅ Completa tareas para farmear más monedas hoy'
}

/**
 * Returns a human-readable list of effect descriptions for an event's modifiers.
 * Used by the UI to render bullet-point summaries.
 */
export function getEventEffectLines(event) {
  if (!event || !event.modifiers) return []
  const m = event.modifiers
  const lines = []
  if (m.taskCoinMultiplier     != null) lines.push(`+${Math.round((m.taskCoinMultiplier - 1) * 100)}% monedas por tarea`)
  if (m.idleCpmMultiplier      != null) lines.push(`+${Math.round((m.idleCpmMultiplier - 1) * 100)}% monedas/min (idle)`)
  if (m.gachaRareBonus         != null) lines.push(`+${Math.round(m.gachaRareBonus * 100)}% tasa rare gacha`)
  if (m.gachaFirstPackDiscount != null) lines.push(`−${Math.round(m.gachaFirstPackDiscount * 100)}% primer pack del día`)
  if (m.boostPriceMultiplier   != null) lines.push(`−${Math.round((1 - m.boostPriceMultiplier) * 100)}% precio boosts`)
  if (m.energyCapBonus         != null) lines.push(`+${m.energyCapBonus} energía máxima`)
  if (m.freeIdleClaimOncePerDay)        lines.push('1 reclamo idle gratis al día')
  return lines
}
