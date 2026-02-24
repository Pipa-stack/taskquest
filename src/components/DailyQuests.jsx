import { motion } from 'framer-motion'

/**
 * DailyQuests – shows the 3 daily quests with progress bars.
 *
 * Props:
 *  quests        – array from useQuests() (with .current, .target, .completed, .rewardClaimed)
 *  questsLoading – boolean, show skeleton while loading
 */
export default function DailyQuests({ quests, questsLoading }) {
  if (questsLoading) {
    return (
      <section className="quests-section">
        <h2 className="section-heading">Misiones del día</h2>
        <div className="quests-loading">Cargando misiones…</div>
      </section>
    )
  }

  return (
    <section className="quests-section">
      <h2 className="section-heading">Misiones del día</h2>
      <ul className="quest-list">
        {quests.map((quest) => {
          const pct =
            quest.target > 0
              ? Math.min(100, Math.round((quest.current / quest.target) * 100))
              : 0
          const done = quest.rewardClaimed

          return (
            <li key={quest.id} className={`quest-item ${done ? 'quest-done' : ''}`}>
              <div className="quest-header">
                <span className="quest-title">{quest.title}</span>
                <span className="quest-reward">+{quest.xpReward} XP</span>
              </div>

              {done ? (
                <div className="quest-completed-label">✅ Completada</div>
              ) : (
                <>
                  <div className="quest-progress-row">
                    <div
                      className="quest-bar-wrap"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${quest.current} de ${quest.target}`}
                    >
                      <motion.div
                        className="quest-bar"
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                      />
                    </div>
                    <span className="quest-count">
                      {quest.target === 1
                        ? pct === 100
                          ? '1/1'
                          : '0/1'
                        : `${quest.current}/${quest.target}`}
                    </span>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
