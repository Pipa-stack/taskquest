import { motion } from 'framer-motion'
import { WEEKLY_TASK_TARGET, WEEKLY_XP_TARGET, WEEKLY_XP_REWARD } from '../domain/quests.js'

/**
 * WeeklyChallenge – shows this week's challenge progress in the Stats tab.
 *
 * Props:
 *  weeklyProgress      – { tasksCount, xpEarned, completed }
 *  weeklyRewardClaimed – boolean
 */
export default function WeeklyChallenge({ weeklyProgress, weeklyRewardClaimed }) {
  const { tasksCount, xpEarned } = weeklyProgress

  const taskPct = Math.min(100, Math.round((tasksCount / WEEKLY_TASK_TARGET) * 100))
  const xpPct = Math.min(100, Math.round((xpEarned / WEEKLY_XP_TARGET) * 100))
  // Overall progress: max of either track
  const overallPct = Math.max(taskPct, xpPct)

  return (
    <section className="weekly-challenge">
      <h2 className="section-heading">Reto semanal</h2>

      {weeklyRewardClaimed ? (
        <div className="weekly-completed">
          <span className="weekly-badge">🏅</span>
          <p>¡Reto completado! +{WEEKLY_XP_REWARD} XP</p>
        </div>
      ) : (
        <>
          <p className="weekly-desc">
            Completa <strong>{WEEKLY_TASK_TARGET} tareas</strong> o gana{' '}
            <strong>{WEEKLY_XP_TARGET} XP</strong> esta semana para desbloquear el badge.
          </p>

          <div className="weekly-tracks">
            {/* Tasks track */}
            <div className="weekly-track">
              <div className="weekly-track-label">
                <span>Tareas completadas</span>
                <span>{tasksCount} / {WEEKLY_TASK_TARGET}</span>
              </div>
              <div
                className="weekly-bar-wrap"
                role="progressbar"
                aria-valuenow={taskPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Tareas: ${tasksCount} de ${WEEKLY_TASK_TARGET}`}
              >
                <motion.div
                  className={`weekly-bar ${taskPct >= 100 ? 'weekly-bar-done' : ''}`}
                  animate={{ width: `${taskPct}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>
            </div>

            {/* XP track */}
            <div className="weekly-track">
              <div className="weekly-track-label">
                <span>XP ganados</span>
                <span>{xpEarned} / {WEEKLY_XP_TARGET}</span>
              </div>
              <div
                className="weekly-bar-wrap"
                role="progressbar"
                aria-valuenow={xpPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`XP: ${xpEarned} de ${WEEKLY_XP_TARGET}`}
              >
                <motion.div
                  className={`weekly-bar ${xpPct >= 100 ? 'weekly-bar-done' : ''}`}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>
            </div>
          </div>

          <p className="weekly-hint">
            Progreso general: {overallPct}%
          </p>
        </>
      )}
    </section>
  )
}
