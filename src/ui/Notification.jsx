/**
 * Toast-style notification that appears after a task is completed.
 * Keyed by notification.id so React remounts it on each new notification,
 * which replays the CSS slide-in animation.
 */
export default function Notification({ notification }) {
  if (!notification) return null

  return (
    <div className="notif" role="status" aria-live="polite">
      <div className="notif__xp">+{notification.xpGained} XP</div>

      {notification.streakBonus > 0 && (
        <div className="notif__bonus">
          🔥 Bonus racha: +{notification.streakBonus} XP
        </div>
      )}

      {notification.leveledUp && (
        <div className="notif__levelup">
          ⬆ ¡Nivel {notification.newLevel.level} — {notification.newLevel.title}!
        </div>
      )}
    </div>
  )
}
