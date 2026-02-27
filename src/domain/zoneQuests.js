/**
 * Zone quest catalog and evaluation helpers for TaskQuest's meta-game.
 *
 * Each zone has 5 quests. Quests scale in difficulty with zone number.
 * Progress is evaluated purely from player state + optional stats object.
 *
 * Quest types:
 *   'tasks_count'          – tasks completed (passed via stats.tasksCompleted)
 *   'coins_total'          – current player coin balance
 *   'characters_unlocked'  – number of unlocked characters
 *   'streak'               – current daily streak
 *   'level'                – current player level (derived from XP)
 *
 * Rewards: { coins: number }
 */

import { xpToLevel } from './gamification.js'

// ---------------------------------------------------------------------------
// Quest catalog (5 per zone × 6 zones)
// ---------------------------------------------------------------------------

const ZONE_QUESTS = {
  1: [
    { id: 'z1_q1', label: 'Completa 3 tareas', type: 'tasks_count', target: 3, reward: { coins: 30 } },
    { id: 'z1_q2', label: 'Acumula 100 🪙', type: 'coins_total', target: 100, reward: { coins: 40 } },
    { id: 'z1_q3', label: 'Desbloquea 1 personaje', type: 'characters_unlocked', target: 1, reward: { coins: 50 } },
    { id: 'z1_q4', label: 'Mantén racha de 2 días', type: 'streak', target: 2, reward: { coins: 40 } },
    { id: 'z1_q5', label: 'Alcanza nivel 2', type: 'level', target: 2, reward: { coins: 60 } },
  ],
  2: [
    { id: 'z2_q1', label: 'Completa 5 tareas', type: 'tasks_count', target: 5, reward: { coins: 50 } },
    { id: 'z2_q2', label: 'Acumula 200 🪙', type: 'coins_total', target: 200, reward: { coins: 60 } },
    { id: 'z2_q3', label: 'Desbloquea 2 personajes', type: 'characters_unlocked', target: 2, reward: { coins: 70 } },
    { id: 'z2_q4', label: 'Mantén racha de 3 días', type: 'streak', target: 3, reward: { coins: 60 } },
    { id: 'z2_q5', label: 'Alcanza nivel 3', type: 'level', target: 3, reward: { coins: 80 } },
  ],
  3: [
    { id: 'z3_q1', label: 'Completa 8 tareas', type: 'tasks_count', target: 8, reward: { coins: 70 } },
    { id: 'z3_q2', label: 'Acumula 400 🪙', type: 'coins_total', target: 400, reward: { coins: 80 } },
    { id: 'z3_q3', label: 'Desbloquea 3 personajes', type: 'characters_unlocked', target: 3, reward: { coins: 90 } },
    { id: 'z3_q4', label: 'Mantén racha de 5 días', type: 'streak', target: 5, reward: { coins: 80 } },
    { id: 'z3_q5', label: 'Alcanza nivel 5', type: 'level', target: 5, reward: { coins: 100 } },
  ],
  4: [
    { id: 'z4_q1', label: 'Completa 12 tareas', type: 'tasks_count', target: 12, reward: { coins: 100 } },
    { id: 'z4_q2', label: 'Acumula 700 🪙', type: 'coins_total', target: 700, reward: { coins: 110 } },
    { id: 'z4_q3', label: 'Desbloquea 4 personajes', type: 'characters_unlocked', target: 4, reward: { coins: 120 } },
    { id: 'z4_q4', label: 'Mantén racha de 7 días', type: 'streak', target: 7, reward: { coins: 110 } },
    { id: 'z4_q5', label: 'Alcanza nivel 7', type: 'level', target: 7, reward: { coins: 130 } },
  ],
  5: [
    { id: 'z5_q1', label: 'Completa 20 tareas', type: 'tasks_count', target: 20, reward: { coins: 150 } },
    { id: 'z5_q2', label: 'Acumula 1000 🪙', type: 'coins_total', target: 1000, reward: { coins: 160 } },
    { id: 'z5_q3', label: 'Desbloquea 5 personajes', type: 'characters_unlocked', target: 5, reward: { coins: 170 } },
    { id: 'z5_q4', label: 'Mantén racha de 10 días', type: 'streak', target: 10, reward: { coins: 160 } },
    { id: 'z5_q5', label: 'Alcanza nivel 10', type: 'level', target: 10, reward: { coins: 180 } },
  ],
  6: [
    { id: 'z6_q1', label: 'Completa 30 tareas', type: 'tasks_count', target: 30, reward: { coins: 200 } },
    { id: 'z6_q2', label: 'Acumula 2000 🪙', type: 'coins_total', target: 2000, reward: { coins: 220 } },
    { id: 'z6_q3', label: 'Desbloquea 6 personajes', type: 'characters_unlocked', target: 6, reward: { coins: 240 } },
    { id: 'z6_q4', label: 'Mantén racha de 14 días', type: 'streak', target: 14, reward: { coins: 220 } },
    { id: 'z6_q5', label: 'Alcanza nivel 15', type: 'level', target: 15, reward: { coins: 250 } },
  ],
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the 5 quest definitions for the given zone.
 *
 * @param {number} zoneId – 1–6
 * @returns {object[]} array of quest objects, or [] for unknown zone
 */
export function getZoneQuests(zoneId) {
  return ZONE_QUESTS[zoneId] ?? []
}

/**
 * Returns a single quest definition by id (searches all zones).
 *
 * @param {string} questId
 * @returns {object|undefined}
 */
export function getQuest(questId) {
  for (const quests of Object.values(ZONE_QUESTS)) {
    const found = quests.find((q) => q.id === questId)
    if (found) return found
  }
  return undefined
}

/**
 * Computes progress for a single quest given current player state and stats.
 *
 * @param {object} quest  – quest definition from ZONE_QUESTS
 * @param {object} stats  – { player, tasksCompleted?: number }
 *   - player           – player record (xp, coins, streak, unlockedCharacters)
 *   - tasksCompleted   – number of tasks completed (for tasks_count quests)
 * @returns {{ current: number, target: number, completed: boolean }}
 */
export function computeQuestProgress(quest, stats) {
  const { player, tasksCompleted = 0 } = stats
  let current = 0

  switch (quest.type) {
    case 'tasks_count':
      current = tasksCompleted
      break
    case 'coins_total':
      current = player.coins ?? 0
      break
    case 'characters_unlocked':
      current = (player.unlockedCharacters ?? []).length
      break
    case 'streak':
      current = player.streak ?? 0
      break
    case 'level':
      current = xpToLevel(player.xp ?? 0)
      break
    default:
      current = 0
  }

  const capped = Math.min(current, quest.target)
  return {
    current: capped,
    target: quest.target,
    completed: current >= quest.target,
  }
}

/**
 * Returns the reward for claiming a quest.
 * Pure function — actual application of the reward happens in the repository layer.
 *
 * @param {object} quest – quest definition
 * @returns {{ coins: number }} reward object
 */
export function claimQuestReward(quest) {
  return { ...quest.reward }
}
