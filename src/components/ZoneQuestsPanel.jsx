import { motion } from 'framer-motion'
import { getZoneQuests, computeQuestProgress, claimQuestReward } from '../domain/zoneQuests.js'
import { playerRepository } from '../repositories/playerRepository.js'

/**
 * Displays the 5 zone quests for the given zone, with progress bars and
 * a "Reclamar" button once a quest is completed.
 *
 * Props:
 *   zoneId          – current zone id (1–6)
 *   player          – player record (for progress evaluation)
 *   tasksCompleted  – number of tasks completed (for tasks_count quest type)
 *   onNotify        – callback(message) for toast notifications
 */
export default function ZoneQuestsPanel({ zoneId, player, tasksCompleted = 0, onNotify }) {
  const quests = getZoneQuests(zoneId)
  const zoneProgress = (player.zoneProgress ?? {})[zoneId] ?? { claimedRewards: [] }

  const handleClaim = async (quest) => {
    const reward = await playerRepository.claimZoneQuest(zoneId, quest.id)
    if (reward && onNotify) {
      onNotify(`+${reward.coins} 🪙 — Quest completada: ${quest.label}`)
    } else if (!reward && onNotify) {
      onNotify('Ya reclamaste esta quest')
    }
  }

  if (quests.length === 0) {
    return <p className="zone-quests-empty">No hay quests disponibles.</p>
  }

  return (
    <div className="zone-quests-panel">
      <h3 className="zone-quests-title">Quests de zona</h3>
      <ul className="zone-quests-list">
        {quests.map((quest) => {
          const progress = computeQuestProgress(quest, { player, tasksCompleted })
          const isClaimed = (zoneProgress.claimedRewards ?? []).includes(quest.id)
          const pct = Math.round((progress.current / progress.target) * 100)

          return (
            <li key={quest.id} className={`zone-quest-item${isClaimed ? ' quest-claimed' : ''}`}>
              <div className="zone-quest-header">
                <span className="zone-quest-label">
                  {isClaimed ? '✓ ' : ''}{quest.label}
                </span>
                <span className="zone-quest-reward">+{quest.reward.coins} 🪙</span>
              </div>

              <div className="zone-quest-progress-wrap">
                <motion.div
                  className="zone-quest-progress-bar"
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>
              <div className="zone-quest-counts">
                {progress.current}/{progress.target}
              </div>

              {progress.completed && !isClaimed && (
                <button
                  className="zone-quest-claim-btn"
                  onClick={() => handleClaim(quest)}
                  type="button"
                >
                  Reclamar
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
