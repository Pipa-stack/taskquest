/**
 * Daily Quests & Weekly Challenge domain.
 *
 * DAILY QUESTS
 * ------------
 * Each day, 3 quests are drawn from QUEST_POOL using a seeded shuffle
 * (seed = dateKey). Same dateKey → always the same 3 quests (deterministic).
 *
 * QUEST_POOL has 12 distinct quest types so there is always variety.
 *
 * Each quest:
 *   id           – unique identifier (used as stable key in UI)
 *   type         – internal type for evaluation logic
 *   title        – human-readable description
 *   xpReward     – XP awarded on completion (50–200)
 *   target       – numeric threshold (meaning depends on type)
 *
 * WEEKLY CHALLENGE
 * ----------------
 * One challenge per ISO week: complete 20 tasks OR earn 2000 XP in the week.
 * Progress is computed live from the tasks table; the DB only stores whether
 * the reward has been claimed.
 */

// ---------------------------------------------------------------------------
// Quest pool (≥10 types)
// ---------------------------------------------------------------------------

/** @typedef {{ id: string, type: string, title: string, xpReward: number, target: number }} QuestDef */

/** @type {QuestDef[]} */
export const QUEST_POOL = [
  {
    id: 'complete_1',
    type: 'complete_tasks',
    title: 'Completa 1 tarea hoy',
    xpReward: 50,
    target: 1,
  },
  {
    id: 'complete_2',
    type: 'complete_tasks',
    title: 'Completa 2 tareas hoy',
    xpReward: 75,
    target: 2,
  },
  {
    id: 'complete_3',
    type: 'complete_tasks',
    title: 'Completa 3 tareas hoy',
    xpReward: 100,
    target: 3,
  },
  {
    id: 'complete_5',
    type: 'complete_tasks',
    title: 'Completa 5 tareas hoy',
    xpReward: 150,
    target: 5,
  },
  {
    id: 'hard_task',
    type: 'hard_task',
    title: 'Completa 1 tarea difícil hoy',
    xpReward: 100,
    target: 1,
  },
  {
    id: 'no_clones',
    type: 'no_clones',
    title: 'Completa tareas sin usar clones hoy',
    xpReward: 75,
    target: 1,
  },
  {
    id: 'combo_12',
    type: 'maintain_combo',
    title: 'Alcanza combo ×1.2',
    xpReward: 80,
    target: 1.2,
  },
  {
    id: 'combo_13',
    type: 'maintain_combo',
    title: 'Alcanza combo ×1.3',
    xpReward: 120,
    target: 1.3,
  },
  {
    id: 'daily_goal',
    type: 'daily_goal',
    title: 'Completa tu objetivo diario',
    xpReward: 100,
    target: 1,
  },
  {
    id: 'earn_xp_200',
    type: 'earn_xp',
    title: 'Gana 200 XP hoy',
    xpReward: 80,
    target: 200,
  },
  {
    id: 'earn_xp_500',
    type: 'earn_xp',
    title: 'Gana 500 XP hoy',
    xpReward: 150,
    target: 500,
  },
  {
    id: 'streak_active',
    type: 'streak',
    title: 'Mantén una racha activa (≥1 día)',
    xpReward: 60,
    target: 1,
  },
]

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32)
// ---------------------------------------------------------------------------

/**
 * Converts a YYYY-MM-DD dateKey to a 32-bit integer seed.
 * @param {string} dateKey
 * @returns {number}
 */
function seedFromDateKey(dateKey) {
  // Remove dashes to get digits, parse as number, fold to 32-bit
  const digits = parseInt(dateKey.replace(/-/g, ''), 10)
  return digits >>> 0
}

/**
 * Returns a seeded pseudo-random number generator (Mulberry32).
 * @param {number} seed 32-bit unsigned integer
 * @returns {() => number} function returning floats in [0, 1)
 */
function mulberry32(seed) {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d2b79f5) >>> 0
    let z = t
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Daily quest generation
// ---------------------------------------------------------------------------

/**
 * Generates the 3 daily quests for a given dateKey.
 * Uses a seeded shuffle so the same date always produces the same quests.
 *
 * @param {string} dateKey YYYY-MM-DD
 * @param {number} [count=3]
 * @returns {Array<QuestDef & { rewardClaimed: boolean }>}
 */
export function generateDailyQuests(dateKey, count = 3) {
  const rng = mulberry32(seedFromDateKey(dateKey))

  // Fisher-Yates shuffle on a copy of the pool
  const pool = [...QUEST_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }

  return pool.slice(0, count).map((q) => ({ ...q, rewardClaimed: false }))
}

// ---------------------------------------------------------------------------
// Quest evaluation context
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} QuestContext
 * @property {number} todayDoneCount     – tasks completed today
 * @property {number} todayCloneCount    – clone tasks completed today
 * @property {number} todayHardCount     – "hard" tasks completed today
 * @property {number} todayXp           – XP earned today (base, no combo)
 * @property {number} combo              – current combo multiplier
 * @property {number} streak             – current streak
 * @property {boolean} dailyGoalMet      – todayDoneCount >= dailyGoal
 */

/**
 * Hard-task detection: a task is "hard" if its title contains any of these
 * keywords (case-insensitive). This avoids adding a difficulty field to the
 * task schema.
 */
const HARD_KEYWORDS = ['hard', 'difícil', 'dificil', 'difficult', 'urgente', 'crítico', 'critico']

/**
 * Returns true if a task title contains a hard-task keyword.
 * @param {string} title
 * @returns {boolean}
 */
export function isHardTask(title) {
  const lower = title.toLowerCase()
  return HARD_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Builds a QuestContext from raw task and player data.
 *
 * @param {Array<{ status: string, isClone?: boolean, title: string }>} todayTasks
 * @param {{ combo: number, streak: number, dailyGoal: number }} player
 * @returns {QuestContext}
 */
export function buildQuestContext(todayTasks, player) {
  const doneTasks = todayTasks.filter((t) => t.status === 'done')
  const todayDoneCount = doneTasks.length
  const todayCloneCount = doneTasks.filter((t) => t.isClone).length
  const todayHardCount = doneTasks.filter((t) => !t.isClone && isHardTask(t.title)).length
  const todayXp = doneTasks.reduce((acc, t) => acc + (t.isClone ? 0 : 100), 0)
  const dailyGoal = player.dailyGoal ?? 3
  const dailyGoalMet = todayDoneCount >= dailyGoal

  return {
    todayDoneCount,
    todayCloneCount,
    todayHardCount,
    todayXp,
    combo: player.combo ?? 1.0,
    streak: player.streak ?? 0,
    dailyGoalMet,
  }
}

// ---------------------------------------------------------------------------
// Quest evaluation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} QuestProgress
 * @property {number} current  – current progress value
 * @property {number} target   – target value to complete the quest
 * @property {boolean} completed – whether the quest condition is met
 */

/**
 * Evaluates a quest against the current context.
 *
 * @param {QuestDef} quest
 * @param {QuestContext} ctx
 * @returns {QuestProgress}
 */
export function evaluateQuest(quest, ctx) {
  let current = 0
  // effectiveTarget normalises binary quests (maintain_combo, no_clones,
  // daily_goal) to a 0/1 scale so `current >= effectiveTarget` is correct.
  let effectiveTarget = quest.target

  switch (quest.type) {
    case 'complete_tasks':
      current = ctx.todayDoneCount
      break

    case 'hard_task':
      current = ctx.todayHardCount
      break

    case 'no_clones':
      // Completed when at least 1 task done and 0 clones completed
      current = ctx.todayDoneCount > 0 && ctx.todayCloneCount === 0 ? 1 : 0
      effectiveTarget = 1
      break

    case 'maintain_combo':
      // Binary: met as soon as the combo threshold is reached
      current = ctx.combo >= quest.target ? 1 : 0
      effectiveTarget = 1
      break

    case 'daily_goal':
      current = ctx.dailyGoalMet ? 1 : 0
      effectiveTarget = 1
      break

    case 'earn_xp':
      current = ctx.todayXp
      break

    case 'streak':
      current = ctx.streak
      break

    default:
      current = 0
  }

  const clamped = Math.min(current, effectiveTarget)
  return { current: clamped, target: effectiveTarget, completed: current >= effectiveTarget }
}

// ---------------------------------------------------------------------------
// Weekly challenge
// ---------------------------------------------------------------------------

export const WEEKLY_TASK_TARGET = 20
export const WEEKLY_XP_TARGET = 2000
export const WEEKLY_XP_REWARD = 500
export const WEEKLY_BADGE_ID = 'weekly_challenger'

/**
 * Evaluates weekly challenge progress.
 *
 * @param {Array<{ status: string, isClone?: boolean }>} weekTasks – all tasks in the current week
 * @returns {{ tasksCount: number, xpEarned: number, completed: boolean }}
 */
export function evaluateWeeklyChallenge(weekTasks) {
  const done = weekTasks.filter((t) => t.status === 'done')
  const tasksCount = done.length
  const xpEarned = done.reduce((acc, t) => acc + (t.isClone ? 0 : 100), 0)
  const completed = tasksCount >= WEEKLY_TASK_TARGET || xpEarned >= WEEKLY_XP_TARGET

  return { tasksCount, xpEarned, completed }
}
