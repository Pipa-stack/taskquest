import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { ZONE_CATALOG, canUnlockZone } from '../domain/zones.js'
import { playerRepository } from '../repositories/playerRepository.js'
import ZoneQuestsPanel from './ZoneQuestsPanel.jsx'
import db from '../db/db.js'
import { todayKey } from '../domain/dateKey.js'

/**
 * Zone map screen — shows all 6 zones as cards.
 *
 * For each zone:
 *   - "Entrar" if already unlocked
 *   - "Desbloquear (X 🪙)" if next zone and power + coins are sufficient
 *   - "🔒 Bloqueada" otherwise
 *
 * Entering a zone changes currentZone and shows its quests.
 *
 * Props:
 *   player     – player record from usePlayer()
 *   powerScore – pre-computed integer power score
 *   onNotify   – callback(message) for toast notifications
 */
export default function ZonesMap({ player, powerScore, onNotify }) {
  const [selectedZone, setSelectedZone] = useState(player.currentZone ?? 1)

  // Count tasks completed this week for quest progress (tasks_count type)
  const today = todayKey()
  const weekStart = useMemo(() => {
    const d = new Date(today)
    const day = d.getDay() // 0 = Sun
    const diff = (day + 6) % 7 // Monday-based: Mon=0 … Sun=6
    d.setDate(d.getDate() - diff)
    return d.toISOString().slice(0, 10)
  }, [today])

  const tasksThisWeek = useLiveQuery(
    () =>
      db.tasks
        .where('dueDate')
        .between(weekStart, today, true, true)
        .and((t) => t.status === 'done')
        .count(),
    [weekStart, today],
    0
  )

  const handleEnter = async (zoneId) => {
    const ok = await playerRepository.setCurrentZone(zoneId)
    if (ok) {
      setSelectedZone(zoneId)
      if (onNotify) onNotify(`Entraste a la zona ${zoneId}`)
    }
  }

  const handleUnlock = async (zone) => {
    const ok = await playerRepository.unlockZone(zone.id, powerScore)
    if (ok) {
      setSelectedZone(zone.id)
      if (onNotify) {
        const msgs = [`🗺️ Zona ${zone.name} desbloqueada!`]
        if (zone.coinsPerMinuteBonus > 0) msgs.push(`+${zone.coinsPerMinuteBonus} 🪙/min`)
        onNotify(msgs.join(' — '))
      }
    } else {
      if (onNotify) onNotify('No cumples los requisitos para desbloquear esta zona')
    }
  }

  return (
    <div className="zones-map">
      {/* Power HUD */}
      <div className="zones-power-hud">
        <span className="zones-power-label">⚡ Power Score</span>
        <span className="zones-power-value">{powerScore}</span>
        <span className="zones-zone-label">📍 Zona actual</span>
        <span className="zones-zone-value">{player.currentZone ?? 1}</span>
      </div>

      {/* Zone cards list */}
      <div className="zones-list">
        {ZONE_CATALOG.map((zone) => {
          const maxUnlocked = player.zoneUnlockedMax ?? 1
          const isUnlocked = zone.id <= maxUnlocked
          const isNext = zone.id === maxUnlocked + 1
          const canUnlock = isNext && canUnlockZone(player, powerScore, zone.id)
          const isActive = zone.id === (player.currentZone ?? 1)

          return (
            <motion.div
              key={zone.id}
              className={`zone-card${isActive ? ' zone-card-active' : ''}${!isUnlocked && !isNext ? ' zone-card-locked' : ''}`}
              style={{ '--zone-color': zone.themeColor }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: zone.id * 0.04 }}
            >
              <div className="zone-card-header">
                <span className="zone-card-emoji">{zone.emoji}</span>
                <div className="zone-card-info">
                  <span className="zone-card-name">{zone.name}</span>
                  <span className="zone-card-meta">
                    {zone.requiredPower > 0 && (
                      <span className={`zone-req-power ${powerScore >= zone.requiredPower ? 'req-met' : 'req-unmet'}`}>
                        ⚡ {zone.requiredPower}
                      </span>
                    )}
                    {zone.unlockCostCoins > 0 && (
                      <span className={`zone-req-coins ${(player.coins ?? 0) >= zone.unlockCostCoins ? 'req-met' : 'req-unmet'}`}>
                        🪙 {zone.unlockCostCoins}
                      </span>
                    )}
                    {zone.coinsPerMinuteBonus > 0 && (
                      <span className="zone-bonus">+{zone.coinsPerMinuteBonus}/min</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="zone-card-actions">
                {isUnlocked && (
                  <button
                    className={`zone-btn zone-btn-enter${isActive ? ' zone-btn-active' : ''}`}
                    onClick={() => handleEnter(zone.id)}
                    type="button"
                  >
                    {isActive ? 'Aquí' : 'Entrar'}
                  </button>
                )}
                {isNext && !isUnlocked && (
                  <button
                    className={`zone-btn zone-btn-unlock${canUnlock ? '' : ' zone-btn-disabled'}`}
                    onClick={() => canUnlock && handleUnlock(zone)}
                    type="button"
                    disabled={!canUnlock}
                    title={!canUnlock ? `Necesitas ⚡${zone.requiredPower} power y 🪙${zone.unlockCostCoins}` : undefined}
                  >
                    Desbloquear ({zone.unlockCostCoins} 🪙)
                  </button>
                )}
                {!isUnlocked && !isNext && (
                  <span className="zone-locked-badge">🔒 Bloqueada</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Zone quests panel for selected zone */}
      <ZoneQuestsPanel
        zoneId={selectedZone}
        player={player}
        tasksCompleted={tasksThisWeek ?? 0}
        onNotify={onNotify}
      />
    </div>
  )
}
