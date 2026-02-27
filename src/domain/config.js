/**
 * Centralized game balance configuration for TaskQuest.
 *
 * Single source of truth for all economy numbers.
 * Domain files import their constants from here so balance
 * can be adjusted in one place.
 *
 * Sections:
 *   PLAYER_DEFAULTS  – starting/fallback values for new/corrupt player records
 *   CAPS             – hard ceilings used by clampPlayer guardrails
 *   IDLE             – idle farming timing constants
 *   BOOST            – boost catalog costs and durations
 *   ZONE_ECONOMY     – zone unlock costs, power requirements, CPM bonuses
 *   GACHA_CFG        – gacha drop rates, pity thresholds, pull cost
 *   XP_CFG           – XP per task and per level
 *   TALENT_CFG       – talent tree limits
 *   DAILY_LOOP_CFG   – daily loop reward amounts
 *   PRESTIGE_CFG     – prestige unlock condition (placeholder)
 */

// ── Player defaults ────────────────────────────────────────────────────────────

export const PLAYER_DEFAULTS = {
  coins:              0,
  energy:             100,
  energyCap:          100,
  coinsPerMinuteBase: 1,
  dailyGoal:          3,
  currentZone:        1,
  zoneUnlockedMax:    1,
  essence:            0,
  essenceSpent:       0,
  streak:             0,
  xp:                 0,
}

// ── Hard caps (guardrail clamps) ───────────────────────────────────────────────

/**
 * Upper bounds applied by clampPlayer() to any player snapshot.
 * Protects against corrupted remote data or run-away accumulation bugs.
 */
export const CAPS = {
  coins:              1_000_000,  // 1M coin ceiling
  energy:             1_000,      // absolute max energy (base + all boost bonuses)
  energyCap:          500,        // max permanent energy cap
  coinsPerMinuteBase: 100,        // max base CPM (zone bonuses included)
  xp:                 10_000_000, // 10M XP safety cap
  streak:             3_650,      // 10 years
  dailyGoal:          20,
  boosts:             20,         // max active boosts stored
  essence:            100_000,
  essenceSpent:       100_000,
}

// ── Idle farming ───────────────────────────────────────────────────────────────

export const IDLE_CFG = {
  /** Max minutes of passive earnings that can accumulate between ticks (anti-whale). */
  maxIdleMinutes: 180,
}

// ── Boost catalog ──────────────────────────────────────────────────────────────
//
// Before → After (PR24 balance pass):
//   coin_x2_2h cost:           380 → 220   better ROI vs 30m (see ROI table below)
//   energy_refill cost:         90 → 75    cheaper refill encourages active play cycles
//
// Boost ROI analysis (coins saved per coin spent):
//   coin_x2_30m  : earns +1× for 30 min → +30 coins at 1 CPM → ROI factor 0.25
//   coin_x2_2h   : earns +1× for 120 min → +120 coins at 1 CPM → new cost 220 → ROI factor 0.55
//   energy_refill: instantly adds up to 100 energy → ~100 coins idle potential; cost 75 → ROI ~1.33

export const BOOST_CFG = {
  coin_x2_30m: {
    cost:          120,   // unchanged
    durationMs:    30 * 60 * 1_000,
    coinMultiplier: 2,
  },
  coin_x2_2h: {
    cost:          220,   // was 380
    durationMs:    120 * 60 * 1_000,
    coinMultiplier: 2,
  },
  energy_cap_plus50_24h: {
    cost:              250,  // unchanged
    durationMs:        24 * 60 * 60 * 1_000,
    energyCapBonus:    50,
  },
  energy_refill: {
    cost:    75,    // was 90
    instant: true,
  },
}

// ── Zone economy ───────────────────────────────────────────────────────────────
//
// Before → After (PR24 balance pass):
//   Zone 2 unlock:  50 → 80    (too cheap; ~50 min idle = near-instant unlock)
//   Zone 3 unlock: 150 → 200   (maintain ~2.5× ratio between consecutive zones)
//   Zone 4 unlock: 300 → 350   (slight increase; ~1.75× zone 3)
//   Zone 5 unlock: 600 → 700   (slight increase; ~2.0× zone 4)
//   Zone 6 unlock: 1000 → 1200 (end-game feel; ~1.71× zone 5)
//
// Zone 1 always free; power requirements unchanged.

export const ZONE_ECONOMY = {
  1: { requiredPower: 0,   unlockCostCoins: 0,    coinsPerMinuteBonus: 0 },
  2: { requiredPower: 20,  unlockCostCoins: 80,   coinsPerMinuteBonus: 1 },  // was 50
  3: { requiredPower: 55,  unlockCostCoins: 200,  coinsPerMinuteBonus: 2 },  // was 150
  4: { requiredPower: 100, unlockCostCoins: 350,  coinsPerMinuteBonus: 3 },  // was 300
  5: { requiredPower: 180, unlockCostCoins: 700,  coinsPerMinuteBonus: 4 },  // was 600
  6: { requiredPower: 300, unlockCostCoins: 1_200, coinsPerMinuteBonus: 5 }, // was 1000
}

// ── Gacha ──────────────────────────────────────────────────────────────────────

export const GACHA_CFG = {
  pullCost:    10,   // coins per pull (unchanged)
  pityDefault: 30,   // guaranteed rare+ after N pulls
  pityMin:     20,   // minimum after talent reduction
  baseRates: {
    common:    0.60,
    uncommon:  0.25,
    rare:      0.10,
    epic:      0.04,
    legendary: 0.01,
  },
}

// ── XP & leveling ──────────────────────────────────────────────────────────────

export const XP_CFG = {
  perTask:  100,  // unchanged
  perLevel: 500,  // unchanged
}

// ── Talent tree ────────────────────────────────────────────────────────────────

export const TALENT_CFG = {
  maxPerBranch: 10, // max talent points per branch
}

// ── Daily loop reward ──────────────────────────────────────────────────────────

export const DAILY_LOOP_CFG = {
  rewardCoins:   50,  // coins on loop completion
  rewardEssence: 10,  // essence on loop completion
}

// ── Prestige (placeholder for future feature) ──────────────────────────────────

export const PRESTIGE_CFG = {
  requiredZone:     6,    // must be at max zone to prestige
  essenceReward:    100,  // essence granted on prestige reset
  coinsReset:       true, // player coins set to 0 on prestige
}

// ── clampPlayer ────────────────────────────────────────────────────────────────

/**
 * Applies hard-cap clamps and safe defaults to any player snapshot.
 *
 * Used as a guardrail in:
 *   - playerRepository write operations (before persisting)
 *   - pullPlayerRemote (sanitizing remote data before merging into Dexie)
 *
 * Rules:
 *   - Numeric fields are clamped to [0, CAPS.field]
 *   - Arrays are validated: boosts list capped at CAPS.boosts items
 *   - Non-numeric/missing fields default to PLAYER_DEFAULTS
 *   - Does NOT mutate the input; returns a new object
 *
 * @param {object} player – player snapshot (may be partially populated or corrupt)
 * @returns {object} sanitized player snapshot
 */
export function clampPlayer(player) {
  if (!player || typeof player !== 'object') return { ...PLAYER_DEFAULTS }

  const clampNum = (val, min, max, def) => {
    // Accept any real number (including ±Infinity); reject NaN and non-numbers
    const n = typeof val === 'number' && !isNaN(val) ? val : def
    return Math.max(min, Math.min(max, n))
  }

  const boosts = Array.isArray(player.boosts)
    ? player.boosts.slice(0, CAPS.boosts)
    : []

  return {
    ...player,
    xp:                 clampNum(player.xp,                 0, CAPS.xp,                 PLAYER_DEFAULTS.xp),
    streak:             clampNum(player.streak,              0, CAPS.streak,              PLAYER_DEFAULTS.streak),
    coins:              clampNum(player.coins,               0, CAPS.coins,               PLAYER_DEFAULTS.coins),
    energy:             clampNum(player.energy,              0, CAPS.energy,              PLAYER_DEFAULTS.energy),
    energyCap:          clampNum(player.energyCap,           1, CAPS.energyCap,           PLAYER_DEFAULTS.energyCap),
    coinsPerMinuteBase: clampNum(player.coinsPerMinuteBase,  1, CAPS.coinsPerMinuteBase,  PLAYER_DEFAULTS.coinsPerMinuteBase),
    dailyGoal:          clampNum(player.dailyGoal,           1, CAPS.dailyGoal,           PLAYER_DEFAULTS.dailyGoal),
    essence:            clampNum(player.essence,             0, CAPS.essence,             PLAYER_DEFAULTS.essence),
    essenceSpent:       clampNum(player.essenceSpent,        0, CAPS.essenceSpent,        PLAYER_DEFAULTS.essenceSpent),
    boosts,
    // energy must not exceed effectiveCap (just base energyCap, not boost-enhanced)
    // further enforcement happens in domain layer with applyBoostsToCaps
    energy: clampNum(
      player.energy,
      0,
      Math.min(CAPS.energy, clampNum(player.energyCap, 1, CAPS.energyCap, PLAYER_DEFAULTS.energyCap)),
      PLAYER_DEFAULTS.energy,
    ),
  }
}
