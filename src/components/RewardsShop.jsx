import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { REWARDS } from '../domain/rewards.js'
import db from '../db/db.js'

/**
 * Rewards shop tab.
 * Shows all 10 rewards. Available ones (xp >= cost, not yet unlocked) can be purchased.
 */
export default function RewardsShop({ xp, rewardsUnlocked, onNotify }) {
  const [busy, setBusy] = useState(null)

  const handleUnlock = useCallback(
    async (reward) => {
      if (busy) return
      setBusy(reward.id)
      try {
        await db.transaction('rw', [db.players], async () => {
          const player = (await db.players.get(1)) ?? { id: 1, xp: 0, rewardsUnlocked: [] }
          const alreadyUnlocked = (player.rewardsUnlocked ?? []).includes(reward.id)
          if (alreadyUnlocked || player.xp < reward.costXP) return

          await db.players.put({
            ...player,
            id: 1,
            xp: player.xp - reward.costXP,
            rewardsUnlocked: [...(player.rewardsUnlocked ?? []), reward.id],
          })
        })
        onNotify(`🎁 Recompensa desbloqueada: ${reward.title}`)
      } finally {
        setBusy(null)
      }
    },
    [busy, onNotify]
  )

  const unlockedSet = new Set(rewardsUnlocked)

  return (
    <div className="rewards-shop">
      <h2 className="section-heading">Tienda de Recompensas</h2>
      <p className="section-sub">XP disponible: <strong>{xp}</strong></p>

      <ul className="rewards-list">
        <AnimatePresence>
          {REWARDS.map((reward) => {
            const isUnlocked = unlockedSet.has(reward.id)
            const canAfford = xp >= reward.costXP
            const isPurchasable = !isUnlocked && canAfford

            return (
              <motion.li
                key={reward.id}
                className={`reward-item ${isUnlocked ? 'reward-unlocked' : ''} ${!canAfford && !isUnlocked ? 'reward-locked' : ''}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="reward-info">
                  <span className="reward-title">{reward.title}</span>
                  <span className="reward-desc">{reward.description}</span>
                </div>
                <div className="reward-action">
                  {isUnlocked ? (
                    <span className="reward-done">✓ Desbloqueada</span>
                  ) : (
                    <button
                      className="btn-reward"
                      disabled={!isPurchasable || busy === reward.id}
                      onClick={() => handleUnlock(reward)}
                    >
                      {busy === reward.id ? '...' : `${reward.costXP} XP`}
                    </button>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
