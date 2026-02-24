/**
 * useQuests – reactive hook for Daily Quests and Weekly Challenge.
 *
 * Daily quests:
 *  - 3 quests are generated deterministically for today's dateKey.
 *  - Generated on first access (if no DB record exists for today).
 *  - Progress is re-evaluated live whenever tasks or player state change.
 *  - When a quest completes, its XP reward is awarded once (rewardClaimed flag).
 *
 * Weekly challenge:
 *  - Progress computed live from the tasks table (tasks in current week).
 *  - Reward awarded once per weekKey (rewardClaimed flag in weeklyChallenge table).
 *
 * @param {{ onReward?: (msg: string) => void }} [opts]
 */
import { useEffect, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'
import { getWeekKey, weekDays } from '../domain/weekKey.js'
import {
  generateDailyQuests,
  buildQuestContext,
  evaluateQuest,
  evaluateWeeklyChallenge,
  WEEKLY_XP_REWARD,
  WEEKLY_BADGE_ID,
} from '../domain/quests.js'

export function useQuests({ onReward } = {}) {
  const today = todayKey()
  const currentWeekKey = getWeekKey()

  // ── Live DB queries ──────────────────────────────────────────────────────

  const dailyRecord = useLiveQuery(() => db.dailyQuests.get(today), [today])
  const player = useLiveQuery(() => db.players.get(1), [])
  const todayTasks = useLiveQuery(
    () => db.tasks.where('dueDate').equals(today).toArray(),
    [today]
  )
  const weekRecord = useLiveQuery(
    () => db.weeklyChallenge.get(currentWeekKey),
    [currentWeekKey]
  )

  // Fetch all tasks for the current week (Mon–Sun)
  const weekStart = weekDays()[0] // Monday dateKey
  const weekTasksRaw = useLiveQuery(
    () => db.tasks.where('dueDate').aboveOrEqual(weekStart).toArray(),
    [weekStart]
  )

  // Filter week tasks to only include the 7 days of this week (not future weeks)
  const weekTasks = useMemo(() => {
    if (!weekTasksRaw) return []
    const days = new Set(weekDays())
    return weekTasksRaw.filter((t) => days.has(t.dueDate))
  }, [weekTasksRaw, weekStart])

  // ── Generate daily quests if missing ─────────────────────────────────────

  useEffect(() => {
    if (dailyRecord !== undefined && !dailyRecord) {
      // No record for today → generate and persist
      const quests = generateDailyQuests(today)
      db.dailyQuests.put({ dateKey: today, quests })
    }
  }, [dailyRecord, today])

  // ── Evaluate quest progress ───────────────────────────────────────────────

  const questsWithProgress = useMemo(() => {
    if (!dailyRecord?.quests || !todayTasks || !player) return []
    const ctx = buildQuestContext(todayTasks, player)
    return dailyRecord.quests.map((q) => ({
      ...q,
      ...evaluateQuest(q, ctx),
    }))
  }, [dailyRecord, todayTasks, player])

  // ── Claim daily quest rewards ─────────────────────────────────────────────
  // Use a ref so we don't re-claim while the async write is in-flight.
  const claimingDailyRef = useRef(new Set())

  useEffect(() => {
    if (!dailyRecord?.quests || !player) return

    for (const quest of questsWithProgress) {
      if (
        quest.completed &&
        !quest.rewardClaimed &&
        !claimingDailyRef.current.has(quest.id)
      ) {
        claimingDailyRef.current.add(quest.id)

        const claim = async () => {
          await db.transaction('rw', [db.dailyQuests, db.players], async () => {
            // Re-read to prevent race conditions
            const record = await db.dailyQuests.get(today)
            if (!record) return

            const alreadyClaimed = record.quests.find(
              (q) => q.id === quest.id && q.rewardClaimed
            )
            if (alreadyClaimed) return

            // Mark quest as claimed
            const updatedQuests = record.quests.map((q) =>
              q.id === quest.id ? { ...q, rewardClaimed: true } : q
            )
            await db.dailyQuests.put({ dateKey: today, quests: updatedQuests })

            // Award XP to player
            const p = (await db.players.get(1)) ?? { id: 1, xp: 0 }
            await db.players.put({ ...p, id: 1, xp: p.xp + quest.xpReward })
          })

          onReward?.(`🎯 Misión completada: ${quest.title} (+${quest.xpReward} XP)`)
        }

        claim().finally(() => claimingDailyRef.current.delete(quest.id))
      }
    }
  }, [questsWithProgress, dailyRecord, player, today, onReward])

  // ── Weekly challenge ─────────────────────────────────────────────────────

  const weeklyProgress = useMemo(() => {
    return evaluateWeeklyChallenge(weekTasks)
  }, [weekTasks])

  const claimingWeeklyRef = useRef(false)

  useEffect(() => {
    if (!weeklyProgress.completed) return
    if (weekRecord?.rewardClaimed) return
    if (claimingWeeklyRef.current) return

    claimingWeeklyRef.current = true

    const claimWeekly = async () => {
      await db.transaction('rw', [db.weeklyChallenge, db.players], async () => {
        const existing = await db.weeklyChallenge.get(currentWeekKey)
        if (existing?.rewardClaimed) return

        await db.weeklyChallenge.put({ weekKey: currentWeekKey, rewardClaimed: true })

        const p = (await db.players.get(1)) ?? { id: 1, xp: 0 }
        const currentBadges = p.achievementsUnlocked ?? []
        await db.players.put({
          ...p,
          id: 1,
          xp: p.xp + WEEKLY_XP_REWARD,
          achievementsUnlocked: currentBadges.includes(WEEKLY_BADGE_ID)
            ? currentBadges
            : [...currentBadges, WEEKLY_BADGE_ID],
        })
      })

      onReward?.(`🏁 Reto semanal completado (+${WEEKLY_XP_REWARD} XP) 🏅`)
    }

    claimWeekly().finally(() => {
      claimingWeeklyRef.current = false
    })
  }, [weeklyProgress.completed, weekRecord, currentWeekKey, onReward])

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    /** Live quests with evaluated progress */
    quests: questsWithProgress,
    /** Whether quests are still loading from DB */
    questsLoading: dailyRecord === undefined || todayTasks === undefined || player === undefined,
    /** Weekly challenge live progress */
    weeklyProgress,
    /** Whether weekly reward has been claimed */
    weeklyRewardClaimed: weekRecord?.rewardClaimed ?? false,
  }
}
